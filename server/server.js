/**
 * Leal.ai - Servidor Backend Node.js + Express
 * Entry point com Helmet (CSP, HSTS), CORS restritivo, Rate Limiting,
 * rotas autenticadas, banco de dados PostgreSQL e tratamento global de erros.
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import { initDatabase } from './config/database.js';
import authRoutes from './routes/auth.js';
import accountRoutes from './routes/accounts.js';
import hierarchyRoutes from './routes/hierarchy.js';
import auditRoutes from './routes/audit.js';
import riskRoutes from './routes/risk.js';
import contractRoutes from './routes/contracts.js';
import journeyRoutes from './routes/journey.js';
import billingRoutes from './routes/billing.js';
import { generalLimiter } from './middleware/rateLimit.js';
import { errorHandler } from './middleware/errorHandler.js';
import { seedInitialAccounts } from '../seeds/demo_accounts.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// 1. HEADERS DE SEGURANÇA COM HELMET (CSP, XSS, Frameguard)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'http://localhost:3001', 'http://localhost:5173', 'http://127.0.0.1:5173']
      }
    },
    crossOriginEmbedderPolicy: false
  })
);

// 2. CONFIGURAÇÃO DE CORS RESTRITIVO
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://localhost:3001')
  .split(',')
  .map(o => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Permite requisições sem origin (como mobile apps, curl ou mesmo domínio)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      // Retorna erro estruturado em vez de falha genérica do middleware
      return callback(
        Object.assign(new Error(`Origem ${origin} bloqueada pela política CORS da Leal.ai.`), {
          status: 403,
          expose: true
        })
      );
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  })
);

// 3. PARSERS DE CORPO DE REQUISIÇÃO
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 4. RATE LIMITING GLOBAL NA API
app.use('/api', generalLimiter);

// 5. ROTAS DE SAÚDE E DIAGNÓSTICO
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'Leal.ai Backend API',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// 6. ROTAS PRINCIPAIS DA APLICAÇÃO
app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/hierarchy', hierarchyRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/risk', riskRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/journey', journeyRoutes);
app.use('/api/billing', billingRoutes);

// 7. SERVIR FRONTEND ESTÁTICO (PRODUÇÃO OU DESENVOLVIMENTO)
const distPath = path.resolve(__dirname, '../dist');
const srcPath = path.resolve(__dirname, '../src');

// Em produção, serve apenas o build otimizado (dist); em dev serve o source com Vite
const isProd = (process.env.NODE_ENV || 'development') === 'production';

app.use(express.static(distPath));
if (!isProd) {
  app.use(express.static(srcPath));
}

const landingFile = isProd
  ? path.resolve(distPath, 'index.html')
  : path.resolve(srcPath, 'index.html');

// Fallback para SPA / Multi-page navigation
const landingFile = isProd
  ? path.resolve(distPath, 'index.html')
  : path.resolve(srcPath, 'index.html');
const cadastroFile = isProd
  ? path.resolve(distPath, 'cadastro.html')
  : path.resolve(srcPath, 'cadastro.html');

app.get('/', (req, res) => {
  res.sendFile(landingFile);
});
app.get('/cadastro', (req, res) => {
  res.sendFile(cadastroFile);
});

// 8. MIDDLEWARE CENTRAL DE ERROS
app.use(errorHandler);

// 9. INICIALIZAÇÃO DO SERVIDOR E BANCO DE DADOS
export async function startServer() {
  await initDatabase();
  await seedInitialAccounts();

  return new Promise((resolve) => {
    const server = app.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`🚀 Leal.ai SaaS Backend rodando com sucesso!`);
      console.log(`🔗 API Server: http://localhost:${PORT}`);
      console.log(`🛡️  Segurança: Helmet, Rate Limiter, CORS e JWT ativos`);
      console.log(`=======================================================`);
      resolve(server);
    });
  });
}

// Inicia automaticamente somente quando executado diretamente e não quando importado por Vercel/serverless
const isDirectExecution = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectExecution) {
  startServer().catch(err => {
    console.error('Falha crítica ao iniciar o servidor:', err);
    process.exit(1);
  });
}

export default app;
