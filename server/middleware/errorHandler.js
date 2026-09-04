/**
 * Leal.ai - Middleware Central de Tratamento de Erros
 * Padroniza respostas de falhas, omite detalhes sensíveis em produção e preserva segurança.
 */

export function errorHandler(err, req, res, next) {
  const isDev = process.env.NODE_ENV !== 'production';
  // Aceita tanto err.statusCode quanto err.status (usado pelo middleware de CORS)
  const statusCode = err.statusCode || err.status || 500;

  console.error(`[Error] ${req.method} ${req.originalUrl}:`, err.message);
  if (isDev && err.stack) {
    console.error(err.stack);
  }

  res.status(statusCode).json({
    success: false,
    error: err.message || 'Erro interno no servidor da plataforma.',
    ...(isDev && { stack: err.stack })
  });
}

export default errorHandler;
