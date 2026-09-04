/**
 * Leal.ai - Seeder de Contas de Demonstração & Migrações
 * Popula a base com as 12 contas corporativas realistas da startup jurídica,
 * gerando hashes seguros com bcrypt (cost factor 12) e IDs UUID v4.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { query, initDatabase, isPgConnected } from '../server/config/database.js';
import { hashPassword } from '../server/utils/passwordGenerator.js';
import { Organization } from '../server/models/Organization.js';
import { User } from '../server/models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Senha padrão de demonstração para os usuários do ecossistema
export const DEMO_DEFAULT_PASSWORD = 'Leal@2026#Segura';

export const INITIAL_DEMO_DATA = [
  {
    name: 'Dra. Maria Oliveira',
    email: 'dra.maria.oliveira@oliveiramedeiros.adv.br',
    category: 'escritorio',
    organization: 'Oliveira & Medeiros Sociedade de Advogados',
    cnpjCpf: '31.987.654/0001-12',
    oab: 'OAB/BA 29.845',
    sector: 'Societário & Governança',
    roleId: 'socio_admin',
    roleName: 'Sócia Administradora (Managing Partner)',
    tier: 'tier-1',
    reportsTo: 'Conselho do Escritório',
    plan: 'Enterprise',
    status: 'active',
    avatar: 'MO',
    permissions: ['contracts_create', 'contracts_review', 'contracts_approve', 'risk_view_all', 'journey_monitor_all', 'journey_adjust', 'team_manage', 'billing_view', 'api_integration']
  },
  {
    name: 'Dr. Gustavo Cerqueira',
    email: 'dr.gustavo@oliveiramedeiros.adv.br',
    category: 'escritorio',
    organization: 'Oliveira & Medeiros Sociedade de Advogados',
    cnpjCpf: '712.334.890-21',
    oab: 'OAB/BA 38.102',
    sector: 'Consultoria Preventiva B2B',
    roleId: 'adv_senior',
    roleName: 'Advogado Sênior / Coordenador Trabalhista',
    tier: 'tier-2',
    reportsTo: 'Dra. Maria Oliveira',
    plan: 'Enterprise',
    status: 'active',
    avatar: 'GC',
    permissions: ['contracts_create', 'contracts_review', 'contracts_approve', 'risk_view_sector', 'journey_monitor_team', 'journey_adjust', 'team_manage']
  },
  {
    name: 'Dra. Juliana Vasconcelos',
    email: 'dra.juliana@oliveiramedeiros.adv.br',
    category: 'escritorio',
    organization: 'Oliveira & Medeiros Sociedade de Advogados',
    cnpjCpf: '543.210.987-65',
    oab: 'OAB/BA 51.490',
    sector: 'Contencioso Trabalhista',
    roleId: 'adv_associado',
    roleName: 'Advogada Associada / Pleno',
    tier: 'tier-3',
    reportsTo: 'Dr. Gustavo Cerqueira',
    plan: 'Enterprise',
    status: 'active',
    avatar: 'JV',
    permissions: ['contracts_create', 'contracts_review', 'journey_monitor_team']
  },
  {
    name: 'Pedro Henrique Santos',
    email: 'pedro.estagio@oliveiramedeiros.adv.br',
    category: 'escritorio',
    organization: 'Oliveira & Medeiros Sociedade de Advogados',
    cnpjCpf: '098.765.432-10',
    oab: 'Estagiário OAB/BA 12.340-E',
    sector: 'Consultoria Preventiva B2B',
    roleId: 'estagiario_dir',
    roleName: 'Estagiário de Direito / Paralegal',
    tier: 'tier-4',
    reportsTo: 'Dra. Juliana Vasconcelos',
    plan: 'Enterprise',
    status: 'active',
    avatar: 'PS',
    permissions: ['contracts_create']
  },
  {
    name: 'Marcos Leal Guimarães',
    email: 'marcos@techflow.io',
    category: 'empresa',
    organization: 'TechFlow Software & Data Ltda',
    cnpjCpf: '45.123.456/0001-89',
    oab: 'Não aplicável',
    sector: 'Diretoria Executiva',
    roleId: 'ceo',
    roleName: 'Diretoria Executiva / CEO / Fundador',
    tier: 'tier-1',
    reportsTo: 'Conselho de Administração',
    plan: 'Pro',
    status: 'active',
    avatar: 'ML',
    permissions: ['contracts_create', 'contracts_review', 'contracts_approve', 'risk_view_all', 'journey_monitor_all', 'journey_adjust', 'team_manage', 'billing_view', 'api_integration']
  },
  {
    name: 'Dra. Carolina Mendonça',
    email: 'carolina.legal@techflow.io',
    category: 'empresa',
    organization: 'TechFlow Software & Data Ltda',
    cnpjCpf: '891.234.567-01',
    oab: 'OAB/SP 412.908',
    sector: 'Jurídico Interno / Compliance',
    roleId: 'head_juridico',
    roleName: 'Head Jurídico / CLO / Compliance',
    tier: 'tier-2',
    reportsTo: 'Marcos Leal Guimarães',
    plan: 'Pro',
    status: 'active',
    avatar: 'CM',
    permissions: ['contracts_create', 'contracts_review', 'contracts_approve', 'risk_view_sector', 'journey_monitor_team', 'journey_adjust', 'team_manage']
  },
  {
    name: 'Renata Albuquerque',
    email: 'renata.rh@techflow.io',
    category: 'empresa',
    organization: 'TechFlow Software & Data Ltda',
    cnpjCpf: '321.654.987-12',
    oab: 'Não aplicável',
    sector: 'Recursos Humanos & DP',
    roleId: 'gerente_rh',
    roleName: 'Gerente de Recursos Humanos & DP',
    tier: 'tier-2',
    reportsTo: 'Marcos Leal Guimarães',
    plan: 'Pro',
    status: 'active',
    avatar: 'RA',
    permissions: ['contracts_create', 'contracts_review', 'contracts_approve', 'risk_view_sector', 'journey_monitor_team', 'journey_adjust', 'team_manage']
  },
  {
    name: 'Lucas Barreto',
    email: 'lucas.dp@techflow.io',
    category: 'empresa',
    organization: 'TechFlow Software & Data Ltda',
    cnpjCpf: '654.987.321-45',
    oab: 'Não aplicável',
    sector: 'Recursos Humanos & DP',
    roleId: 'analista_dp',
    roleName: 'Analista de DP / Operador de RH',
    tier: 'tier-3',
    reportsTo: 'Renata Albuquerque',
    plan: 'Pro',
    status: 'active',
    avatar: 'LB',
    permissions: ['contracts_create', 'contracts_review', 'journey_monitor_team']
  },
  {
    name: 'Dr. Roberto Silveira',
    email: 'roberto@silveiraadvocacia.com.br',
    category: 'advogado',
    organization: 'Roberto Silveira Consultoria Trabalhista',
    cnpjCpf: '234.567.890-33',
    oab: 'OAB/MG 145.890',
    sector: 'Atendimento a Startups',
    roleId: 'adv_titular',
    roleName: 'Advogado Titular Independente',
    tier: 'tier-1',
    reportsTo: 'Conselho / Diretoria Geral',
    plan: 'Starter',
    status: 'active',
    avatar: 'RS',
    permissions: ['contracts_create', 'contracts_review', 'contracts_approve', 'risk_view_all', 'journey_monitor_all', 'journey_adjust', 'team_manage', 'billing_view', 'api_integration']
  },
  {
    name: 'Vanessa Rocha',
    email: 'vanessa@apexcontabilidade.com.br',
    category: 'contabilidade',
    organization: 'Apex BPO & Contabilidade Estratégica',
    cnpjCpf: '12.345.678/0001-90',
    oab: 'Não aplicável (CRC/SP 89.412)',
    sector: 'Folha de Pagamento & eSocial',
    roleId: 'resp_contabil',
    roleName: 'Responsável Técnica / Sócia Contábil',
    tier: 'tier-1',
    reportsTo: 'Diretoria Apex BPO',
    plan: 'Enterprise',
    status: 'active',
    avatar: 'VR',
    permissions: ['contracts_create', 'contracts_review', 'contracts_approve', 'risk_view_all', 'journey_monitor_all', 'journey_adjust', 'team_manage', 'billing_view', 'api_integration']
  },
  {
    name: 'Thiago Nogueira (Dev Fullstack)',
    email: 'thiago.nogueira.pj@techflow.io',
    category: 'colaborador',
    organization: 'TechFlow Software & Data Ltda',
    cnpjCpf: '98.765.432/0001-09',
    oab: 'Não aplicável',
    sector: 'Tecnologia & Produto',
    roleId: 'prestador_pj',
    roleName: 'Prestador de Serviços (PJ)',
    tier: 'tier-5',
    reportsTo: 'Marcos Leal Guimarães',
    plan: 'Pro',
    status: 'active',
    avatar: 'TN',
    permissions: []
  },
  {
    name: 'Admin Master Leal.ai',
    email: 'admin@leal.ai',
    category: 'leal_admin',
    organization: 'Leal.ai Tecnologia Jurídica S.A.',
    cnpjCpf: '00.111.222/0001-33',
    oab: 'OAB/BA 99.999',
    sector: 'Compliance & Segurança',
    roleId: 'super_admin',
    roleName: 'Super Administrador da Plataforma',
    tier: 'tier-1',
    reportsTo: 'Board Leal.ai',
    plan: 'Enterprise',
    status: 'active',
    avatar: 'LA',
    permissions: ['contracts_create', 'contracts_review', 'contracts_approve', 'risk_view_all', 'journey_monitor_all', 'journey_adjust', 'team_manage', 'billing_view', 'api_integration']
  }
];

/**
 * Executa as migrações SQL no banco de dados PostgreSQL
 */
export async function runMigrations() {
  if (!isPgConnected) {
    console.log('ℹ️  [Migrations] PostgreSQL offline. Estrutura aplicada na memória/armazenamento dev.');
    return;
  }

  const migrationsDir = path.resolve(__dirname, '../migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.log('ℹ️  [Migrations] Nenhuma pasta de migrações encontrada.');
    return;
  }

  // Lê todos os arquivos .sql, ordena pelo nome (001_, 002_, ...), e aplica sequencialmente
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    try {
      const sql = fs.readFileSync(filePath, 'utf-8');
      await query(sql);
      console.log(`✓ [Migrations] Migração ${file} aplicada com sucesso.`);
    } catch (err) {
      console.error(`❌ [Migrations Error] Falha ao aplicar migração ${file}:`, err.message);
      // Não interrompe a aplicação de migrações seguintes — registra o erro e continua
    }
  }
}

/**
 * Popula a base de dados com as contas de demonstração caso esteja vazia
 */
export async function seedInitialAccounts() {
  try {
    // Garante que todas as migrações sejam aplicadas antes de semear dados
    try {
      await runMigrations();
    } catch (mErr) {
      console.warn('⚠️ [Seeder] Erro ao aplicar migrações antes do seeding:', mErr.message || mErr);
      // Continua — se o banco já estiver com esquema parcial, o seeding pode falhar e será tratado abaixo
    }

    const existing = await User.findAll();
    if (existing && existing.length > 0) {
      console.log(`ℹ️  [Seeder] Base de dados já contém ${existing.length} contas cadastradas.`);
      return;
    }

    console.log('🌱 [Seeder] Populando banco de dados com contas iniciais realistas...');
    const defaultPasswordHash = await hashPassword(DEMO_DEFAULT_PASSWORD);

    for (const item of INITIAL_DEMO_DATA) {
      const org = await Organization.findOrCreate({
        name: item.organization,
        cnpj: item.cnpjCpf,
        type: item.category,
        plan: item.plan
      });

      await User.create({
        id: uuidv4(),
        orgId: org.id,
        name: item.name,
        email: item.email,
        passwordHash: defaultPasswordHash,
        role: item.roleId,
        roleName: item.roleName,
        tier: item.tier,
        sector: item.sector,
        oab: item.oab,
        reportsTo: item.reportsTo,
        avatar: item.avatar,
        status: item.status,
        permissions: item.permissions
      });
    }

    console.log(`✓ [Seeder] 12 contas demonstrativas criadas com senha padrão: "${DEMO_DEFAULT_PASSWORD}"`);
  } catch (err) {
    console.error('❌ [Seeder Error]', err.message);
  }
}

// Execução direta via terminal: node seeds/demo_accounts.js
if (process.argv[1] && process.argv[1].endsWith('demo_accounts.js')) {
  (async () => {
    await initDatabase();
    await runMigrations();
    if (!process.argv.includes('--migrate-only')) {
      await seedInitialAccounts();
    }
    console.log('🏁 Processo finalizado.');
    process.exit(0);
  })();
}

export default {
  seedInitialAccounts,
  runMigrations,
  INITIAL_DEMO_DATA
};
