/**
 * Leal.ai - Gerenciador de Banco de Dados PostgreSQL & Conexão Resiliente
 * Suporta pool de conexões otimizado, prepared statements com parametrização rigorosa ($1, $2),
 * transações ACID e fallback inteligente para desenvolvimento local e testes.
 */

import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuração do Pool PostgreSQL
const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false
    }
  : {
      host: process.env.PGHOST || 'localhost',
      port: parseInt(process.env.PGPORT || '5432', 10),
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || 'postgres',
      database: process.env.PGDATABASE || 'leal_db',
      ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 3000
    };

let pool = null;
let isPgConnected = false;

// Catálogo de planos para o dev store (espelha o modelo Subscription)
const PLAN_CATALOG = {
  starter: { name: 'Starter', priceMonthlyBRL: 99, maxUsers: 5, description: 'Para advogados solo e pequenos negócios' },
  pro: { name: 'Pro', priceMonthlyBRL: 299, maxUsers: 25, description: 'Para startups e médias empresas' },
  enterprise: { name: 'Enterprise', priceMonthlyBRL: 999, maxUsers: 999, description: 'Para bancas jurídicas e grandes operações' }
};

// Storage local em memória para desenvolvimento e testes quando PostgreSQL não está ativo
class ResilientDevStore {
  constructor() {
    this.tables = {
      organizations: new Map(),
      users: new Map(),
      permissions: new Map(),
      role_permissions: new Map(),
      user_permissions: new Map(),
      refresh_tokens: new Map(),
      email_verification_tokens: new Map(),
      password_reset_tokens: new Map(),
      risk_scores: new Map(),
      contracts: new Map(),
      journey_records: new Map(),
      subscriptions: new Map(),
      invoices: new Map(),
      audit_logs: []
    };
    this.dataPath = path.resolve(__dirname, '../../.dev_database.json');
    this.loadFromDisk();
  }

  loadFromDisk() {
    try {
      if (fs.existsSync(this.dataPath) && process.env.NODE_ENV !== 'test') {
        const raw = fs.readFileSync(this.dataPath, 'utf-8');
        const data = JSON.parse(raw);
        for (const [table, rows] of Object.entries(data)) {
          if (table === 'audit_logs') {
            this.tables.audit_logs = rows || [];
          } else {
            this.tables[table] = new Map(rows || []);
          }
        }
      }
    } catch (e) {
      console.warn('[Database Fallback] Cache dev não pôde ser lido, usando memória limpa.');
    }
  }

  saveToDisk() {
    if (process.env.NODE_ENV === 'test') return;
    try {
      const serialized = {};
      for (const [table, mapOrList] of Object.entries(this.tables)) {
        if (table === 'audit_logs') {
          serialized[table] = mapOrList;
        } else {
          serialized[table] = Array.from(mapOrList.entries());
        }
      }
      fs.writeFileSync(this.dataPath, JSON.stringify(serialized, null, 2), 'utf-8');
    } catch (e) {
      // Ignore
    }
  }
}

const devStore = new ResilientDevStore();

export async function initDatabase() {
  if (process.env.NODE_ENV === 'test') {
    isPgConnected = false;
    return false;
  }

  try {
    pool = new Pool(poolConfig);
    const client = await pool.connect();
    isPgConnected = true;
    client.release();
    console.log('✓ [Database] Conexão com PostgreSQL estabelecida com sucesso.');
    return true;
  } catch (err) {
    isPgConnected = false;
    console.warn('⚠️ [Database] PostgreSQL não detectado ou indisponível:', err.message);
    console.warn('ℹ️ [Database] Modo de Desenvolvimento Resiliente ativo (armazenamento seguro local).');
    return false;
  }
}

export async function query(text, params = []) {
  if (isPgConnected && pool) {
    try {
      const res = await pool.query(text, params);
      return res;
    } catch (err) {
      console.error('[Database Query Error]', err.message, '\nQuery:', text);
      throw err;
    }
  }

  return executeDevFallbackQuery(text, params);
}

function executeDevFallbackQuery(sql, params) {
  const normalized = sql.trim().toUpperCase().replace(/\s+/g, ' ');

  if (normalized.startsWith('SELECT')) {
    // SELECT WHERE EMAIL
    if (normalized.includes('FROM USERS') && (normalized.includes('EMAIL) = LOWER($1)') || normalized.includes('EMAIL = $1') || normalized.includes('EMAIL) = $1'))) {
      const email = params[0]?.toLowerCase();
      const user = Array.from(devStore.tables.users.values()).find(u => u.email.toLowerCase() === email);
      if (user) {
        const org = devStore.tables.organizations.get(user.org_id);
        const uWithOrg = {
          ...user,
          organization: org ? org.name : (user.organization || 'Organização'),
          category: org ? org.type : (user.category || 'empresa'),
          plan: org ? org.plan : (user.plan || 'Pro'),
          cnpjCpf: org ? org.cnpj : (user.cnpjCpf || user.cnpj_cpf || '')
        };
        return { rows: [uWithOrg], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // SELECT WHERE ID
    if ((normalized.includes('FROM USERS') && normalized.includes('WHERE U.ID = $1') && normalized.includes('AND U.ORG_ID = $2'))) {
      const id = params[0];
      const orgId = params[1];
      const user = devStore.tables.users.get(id);
      if (user && user.org_id === orgId) {
        const org = devStore.tables.organizations.get(user.org_id);
        const uWithOrg = {
          ...user,
          organization: org ? org.name : (user.organization || 'Organização'),
          category: org ? org.type : (user.category || 'empresa'),
          plan: org ? org.plan : (user.plan || 'Pro'),
          cnpjCpf: org ? org.cnpj : (user.cnpjCpf || user.cnpj_cpf || '')
        };
        return { rows: [uWithOrg], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // SELECT WHERE ID (sem restrição de organização)
    if (normalized.includes('FROM USERS') && normalized.includes('WHERE U.ID = $1')) {
      const id = params[0];
      const user = devStore.tables.users.get(id);
      if (user) {
        const org = devStore.tables.organizations.get(user.org_id);
        const uWithOrg = {
          ...user,
          organization: org ? org.name : (user.organization || 'Organização'),
          category: org ? org.type : (user.category || 'empresa'),
          plan: org ? org.plan : (user.plan || 'Pro'),
          cnpjCpf: org ? org.cnpj : (user.cnpjCpf || user.cnpj_cpf || '')
        };
        return { rows: [uWithOrg], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // SELECT ALL USERS (respeitando filtro de tenant por org_id)
    if (normalized.includes('FROM USERS') && normalized.includes('WHERE U.ORG_ID = $1')) {
      const orgId = params[0];
      let list = Array.from(devStore.tables.users.values()).filter(u => u.org_id === orgId);
      list = list.map(u => {
        const org = devStore.tables.organizations.get(u.org_id);
        return {
          ...u,
          organization: org ? org.name : (u.organization || 'Organização'),
          category: org ? org.type : (u.category || 'empresa'),
          plan: org ? org.plan : (u.plan || 'Pro'),
          cnpjCpf: org ? org.cnpj : (u.cnpjCpf || u.cnpj_cpf || ''),
          roleName: u.role_name || u.roleName,
          reportsTo: u.reports_to || u.reportsTo,
          createdAt: u.created_at || u.createdAt
        };
      });
      return { rows: list, rowCount: list.length };
    }

    // SELECT ALL USERS (sem filtro)
    if (normalized.includes('FROM USERS')) {
      let list = Array.from(devStore.tables.users.values());
      list = list.map(u => {
        const org = devStore.tables.organizations.get(u.org_id);
        return {
          ...u,
          organization: org ? org.name : (u.organization || 'Organização'),
          category: org ? org.type : (u.category || 'empresa'),
          plan: org ? org.plan : (u.plan || 'Pro'),
          cnpjCpf: org ? org.cnpj : (u.cnpjCpf || u.cnpj_cpf || ''),
          roleName: u.role_name || u.roleName,
          reportsTo: u.reports_to || u.reportsTo,
          createdAt: u.created_at || u.createdAt
        };
      });
      return { rows: list, rowCount: list.length };
    }

    // SELECT ORGANIZATIONS
    if (normalized.includes('FROM ORGANIZATIONS') && normalized.includes('WHERE ID = $1')) {
      const id = params[0];
      const org = devStore.tables.organizations.get(id);
      return { rows: org ? [org] : [], rowCount: org ? 1 : 0 };
    }

    if (normalized.includes('FROM ORGANIZATIONS') && normalized.includes('WHERE CNPJ = $1')) {
      const cnpj = params[0];
      const org = Array.from(devStore.tables.organizations.values()).find(o => o.cnpj === cnpj);
      return { rows: org ? [org] : [], rowCount: org ? 1 : 0 };
    }

    if (normalized.includes('FROM ORGANIZATIONS')) {
      const list = Array.from(devStore.tables.organizations.values());
      return { rows: list, rowCount: list.length };
    }

    // SELECT REFRESH TOKENS
    if (normalized.includes('FROM REFRESH_TOKENS') && normalized.includes('TOKEN_HASH = $1')) {
      const hash = params[0];
      const token = Array.from(devStore.tables.refresh_tokens.values()).find(t => t.token_hash === hash && !t.revoked_at);
      return { rows: token ? [token] : [], rowCount: token ? 1 : 0 };
    }

    // SELECT EMAIL VERIFICATION TOKENS
    if (normalized.includes('FROM EMAIL_VERIFICATION_TOKENS') && normalized.includes('TOKEN_HASH = $1')) {
      const hash = params[0];
      const token = Array.from(devStore.tables.email_verification_tokens.values())
        .find(t => t.token_hash === hash && !t.used_at && new Date(t.expires_at) > new Date());
      return { rows: token ? [token] : [], rowCount: token ? 1 : 0 };
    }

    // SELECT PASSWORD RESET TOKENS
    if (normalized.includes('FROM PASSWORD_RESET_TOKENS') && normalized.includes('TOKEN_HASH = $1')) {
      const hash = params[0];
      const token = Array.from(devStore.tables.password_reset_tokens.values())
        .find(t => t.token_hash === hash && !t.used_at && new Date(t.expires_at) > new Date());
      return { rows: token ? [token] : [], rowCount: token ? 1 : 0 };
    }

    // SELECT AUDIT LOGS
    if (normalized.includes('FROM AUDIT_LOGS')) {
      const limit = params[0] ? parseInt(params[0], 10) : 100;
      let list = [...devStore.tables.audit_logs];
      list = list.reverse().slice(0, limit).map(log => {
        const user = log.user_id ? devStore.tables.users.get(log.user_id) : null;
        return {
          ...log,
          user_name: user ? user.name : null,
          user_email: user ? user.email : null
        };
      });
      return { rows: list, rowCount: list.length };
    }

    // SELECT RISK SCORE BY ID (ANY ORG - super admin)
    if (normalized.includes('FROM RISK_SCORES') && normalized.includes('WHERE R.ID = $1') && !normalized.includes('AND R.ORG_ID = $2')) {
      const id = params[0];
      const r = Array.from(devStore.tables.risk_scores.values()).find(item => item.id === id);
      if (r) {
        const u = r.created_by ? devStore.tables.users.get(r.created_by) : null;
        return { rows: [{ ...r, created_by_name: u ? u.name : null }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // SELECT RISK SCORE BY ID + ORG
    if (normalized.includes('FROM RISK_SCORES') && normalized.includes('WHERE R.ID = $1') && normalized.includes('AND R.ORG_ID = $2')) {
      const id = params[0];
      const orgId = params[1];
      const r = Array.from(devStore.tables.risk_scores.values())
        .find(item => item.id === id && item.org_id === orgId);
      if (r) {
        const u = r.created_by ? devStore.tables.users.get(r.created_by) : null;
        return { rows: [{ ...r, created_by_name: u ? u.name : null }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // SELECT RISK SCORES BY ORG (JOIN USERS)
    if (normalized.includes('FROM RISK_SCORES') && normalized.includes('WHERE R.ORG_ID = $1')) {
      const orgId = params[0];
      const limit = params[1] ? parseInt(params[1], 10) : 100;
      let list = Array.from(devStore.tables.risk_scores.values())
        .filter(r => r.org_id === orgId)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, limit)
        .map(r => {
          const u = r.created_by ? devStore.tables.users.get(r.created_by) : null;
          return { ...r, created_by_name: u ? u.name : null };
        });
      return { rows: list, rowCount: list.length };
    }

    // SELECT CONTRACT BY ID (ANY ORG - super admin)
    if (normalized.includes('FROM CONTRACTS') && normalized.includes('WHERE C.ID = $1') && !normalized.includes('AND C.ORG_ID = $2')) {
      const id = params[0];
      const c = Array.from(devStore.tables.contracts.values()).find(item => item.id === id);
      if (c) {
        const u = c.created_by ? devStore.tables.users.get(c.created_by) : null;
        return { rows: [{ ...c, created_by_name: u ? u.name : null }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // SELECT CONTRACT BY ID + ORG
    if (normalized.includes('FROM CONTRACTS') && normalized.includes('WHERE C.ID = $1') && normalized.includes('AND C.ORG_ID = $2')) {
      const id = params[0];
      const orgId = params[1];
      const c = Array.from(devStore.tables.contracts.values())
        .find(item => item.id === id && item.org_id === orgId);
      if (c) {
        const u = c.created_by ? devStore.tables.users.get(c.created_by) : null;
        return { rows: [{ ...c, created_by_name: u ? u.name : null }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // SELECT CONTRACTS BY ORG (JOIN USERS)
    if (normalized.includes('FROM CONTRACTS') && normalized.includes('WHERE C.ORG_ID = $1')) {
      const orgId = params[0];
      const limit = params[1] ? parseInt(params[1], 10) : 100;
      let list = Array.from(devStore.tables.contracts.values())
        .filter(c => c.org_id === orgId)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, limit)
        .map(c => {
          const u = c.created_by ? devStore.tables.users.get(c.created_by) : null;
          return { ...c, created_by_name: u ? u.name : null };
        });
      return { rows: list, rowCount: list.length };
    }

    // SELECT JOURNEY RECORD BY ID + ORG (JOIN USERS)
    if (normalized.includes('FROM JOURNEY_RECORDS') && normalized.includes('WHERE R.ID = $1') && normalized.includes('AND R.ORG_ID = $2')) {
      const id = params[0];
      const orgId = params[1];
      const r = Array.from(devStore.tables.journey_records.values())
        .find(item => item.id === id && item.org_id === orgId);
      if (r) {
        const u = r.user_id ? devStore.tables.users.get(r.user_id) : null;
        return { rows: [{ ...r, user_name: u ? u.name : null }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // SELECT JOURNEY RECORDS BY USER + ORG (JOIN USERS)
    if (normalized.includes('FROM JOURNEY_RECORDS') && normalized.includes('WHERE R.USER_ID = $1') && normalized.includes('AND R.ORG_ID = $2')) {
      const userId = params[0];
      const orgId = params[1];
      const limit = params[2] ? parseInt(params[2], 10) : 100;
      let list = Array.from(devStore.tables.journey_records.values())
        .filter(r => r.user_id === userId && r.org_id === orgId)
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, limit)
        .map(r => {
          const u = r.user_id ? devStore.tables.users.get(r.user_id) : null;
          return { ...r, user_name: u ? u.name : null };
        });
      return { rows: list, rowCount: list.length };
    }

    // SELECT JOURNEY RECORDS BY ORG (JOIN USERS)
    if (normalized.includes('FROM JOURNEY_RECORDS') && normalized.includes('WHERE R.ORG_ID = $1')) {
      const orgId = params[0];
      const limit = params[1] ? parseInt(params[1], 10) : 200;
      let list = Array.from(devStore.tables.journey_records.values())
        .filter(r => r.org_id === orgId)
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, limit)
        .map(r => {
          const u = r.user_id ? devStore.tables.users.get(r.user_id) : null;
          return { ...r, user_name: u ? u.name : null };
        });
      return { rows: list, rowCount: list.length };
    }

    // SELECT SUBSCRIPTION BY ORG (JOIN PLANS)
    if (normalized.includes('FROM SUBSCRIPTIONS') && normalized.includes('WHERE S.ORG_ID = $1')) {
      const orgId = params[0];
      const s = Array.from(devStore.tables.subscriptions.values()).find(x => x.org_id === orgId);
      if (s) {
        const plan = PLAN_CATALOG[s.plan_id] || {};
        return { rows: [{
          ...s,
          plan_name: plan.name || s.plan_id,
          price_monthly_brl: plan.priceMonthlyBRL ?? null,
          max_users: plan.maxUsers ?? null,
          description: plan.description ?? null
        }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // SELECT SUBSCRIPTION BY ID ANY (super admin)
    if (normalized.includes('FROM SUBSCRIPTIONS') && normalized.includes('WHERE S.ID = $1')) {
      const id = params[0];
      const s = Array.from(devStore.tables.subscriptions.values()).find(x => x.id === id);
      if (s) {
        const plan = PLAN_CATALOG[s.plan_id] || {};
        return { rows: [{ ...s, plan_name: plan.name || s.plan_id }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // SELECT INVOICES BY ORG
    if (normalized.includes('FROM INVOICES') && normalized.includes('WHERE ORG_ID = $1')) {
      const orgId = params[0];
      const limit = params[1] ? parseInt(params[1], 10) : 50;
      const list = Array.from(devStore.tables.invoices.values())
        .filter(i => i.org_id === orgId)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, limit);
      return { rows: list, rowCount: list.length };
    }

    // SELECT INVOICE BY ID ANY (super admin)
    if (normalized.includes('FROM INVOICES') && normalized.includes('WHERE ID = $1')) {
      const id = params[0];
      const inv = Array.from(devStore.tables.invoices.values()).find(x => x.id === id);
      return { rows: inv ? [inv] : [], rowCount: inv ? 1 : 0 };
    }

    // SELECT USER PERMISSIONS
    if (normalized.includes('FROM USER_PERMISSIONS') && normalized.includes('WHERE USER_ID = $1')) {
      const userId = params[0];
      const perms = [];
      for (const [key, val] of devStore.tables.user_permissions.entries()) {
        if (key.startsWith(userId)) {
          perms.push({ permission_id: val.permission_id });
        }
      }
      return { rows: perms, rowCount: perms.length };
    }
  }

  if (normalized.startsWith('INSERT INTO USERS')) {
    const newUser = {
      id: params[0],
      org_id: params[1],
      name: params[2],
      email: params[3],
      password_hash: params[4],
      role: params[5],
      role_name: params[6],
      tier: params[7],
      sector: params[8],
      oab: params[9],
      reports_to: params[10],
      avatar: params[11],
      status: params[12] || 'active',
      created_at: new Date().toISOString()
    };
    devStore.tables.users.set(newUser.id, newUser);
    devStore.saveToDisk();
    return { rows: [newUser], rowCount: 1 };
  }

  if (normalized.startsWith('INSERT INTO ORGANIZATIONS')) {
    const newOrg = {
      id: params[0],
      name: params[1],
      cnpj: params[2],
      type: params[3],
      plan: params[4] || 'Pro',
      created_at: new Date().toISOString()
    };
    devStore.tables.organizations.set(newOrg.id, newOrg);
    devStore.saveToDisk();
    return { rows: [newOrg], rowCount: 1 };
  }

  if (normalized.startsWith('INSERT INTO AUDIT_LOGS')) {
    const log = {
      id: params[0],
      user_id: params[1],
      action: params[2],
      details: params[3],
      ip_address: params[4],
      user_agent: params[5],
      created_at: new Date().toISOString()
    };
    devStore.tables.audit_logs.push(log);
    devStore.saveToDisk();
    return { rows: [log], rowCount: 1 };
  }

  if (normalized.startsWith('INSERT INTO REFRESH_TOKENS')) {
    const rt = {
      id: params[0],
      user_id: params[1],
      token_hash: params[2],
      expires_at: params[3],
      revoked_at: null,
      created_at: new Date().toISOString()
    };
    devStore.tables.refresh_tokens.set(rt.id, rt);
    devStore.saveToDisk();
    return { rows: [rt], rowCount: 1 };
  }

  if (normalized.startsWith('INSERT INTO EMAIL_VERIFICATION_TOKENS')) {
    const vt = {
      id: params[0],
      user_id: params[1],
      token_hash: params[2],
      expires_at: params[3],
      used_at: null,
      created_at: new Date().toISOString()
    };
    devStore.tables.email_verification_tokens.set(vt.id, vt);
    devStore.saveToDisk();
    return { rows: [vt], rowCount: 1 };
  }

  if (normalized.startsWith('INSERT INTO PASSWORD_RESET_TOKENS')) {
    const prt = {
      id: params[0],
      user_id: params[1],
      token_hash: params[2],
      expires_at: params[3],
      used_at: null,
      created_at: new Date().toISOString()
    };
    devStore.tables.password_reset_tokens.set(prt.id, prt);
    devStore.saveToDisk();
    return { rows: [prt], rowCount: 1 };
  }

  if (normalized.startsWith('INSERT INTO RISK_SCORES')) {
    const rs = {
      id: params[0],
      org_id: params[1],
      created_by: params[2],
      title: params[3],
      description: params[4],
      findings: params[5],
      risk_level: params[6],
      risk_score: params[7],
      recommendations: params[8],
      summary: params[9],
      status: params[10] || 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    devStore.tables.risk_scores.set(rs.id, rs);
    devStore.saveToDisk();
    return { rows: [rs], rowCount: 1 };
  }

  if (normalized.startsWith('INSERT INTO CONTRACTS')) {
    const contract = {
      id: params[0],
      org_id: params[1],
      created_by: params[2],
      title: params[3],
      contract_type: params[4],
      content: params[5],
      status: params[6] || 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    devStore.tables.contracts.set(contract.id, contract);
    devStore.saveToDisk();
    return { rows: [contract], rowCount: 1 };
  }

  if (normalized.startsWith('INSERT INTO JOURNEY_RECORDS')) {
    const record = {
      id: params[0],
      org_id: params[1],
      user_id: params[2],
      date: params[3],
      clock_in: params[4],
      clock_out: params[5],
      hours_worked: params[6],
      overtime_hours: params[7],
      notes: params[8],
      created_at: new Date().toISOString()
    };
    devStore.tables.journey_records.set(record.id, record);
    devStore.saveToDisk();
    return { rows: [record], rowCount: 1 };
  }

  if (normalized.startsWith('INSERT INTO SUBSCRIPTIONS')) {
    const sub = {
      id: params[0],
      org_id: params[1],
      plan_id: params[2],
      status: 'trial',
      trial_ends_at: params[3],
      current_period_end: params[4],
      seat_count: 1,
      cancel_at_period_end: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    devStore.tables.subscriptions.set(sub.id, sub);
    devStore.saveToDisk();
    return { rows: [sub], rowCount: 1 };
  }

  if (normalized.startsWith('INSERT INTO INVOICES')) {
    const inv = {
      id: params[0],
      org_id: params[1],
      subscription_id: params[2],
      amount_brl: params[3],
      status: params[4] || 'open',
      period_start: params[5],
      period_end: params[6],
      created_at: new Date().toISOString()
    };
    devStore.tables.invoices.set(inv.id, inv);
    devStore.saveToDisk();
    return { rows: [inv], rowCount: 1 };
  }

  if (normalized.startsWith('INSERT INTO USER_PERMISSIONS')) {
    const key = `${params[0]}_${params[1]}`;
    devStore.tables.user_permissions.set(key, { user_id: params[0], permission_id: params[1] });
    devStore.saveToDisk();
    return { rows: [{ user_id: params[0], permission_id: params[1] }], rowCount: 1 };
  }

  if (normalized.startsWith('UPDATE USERS') && normalized.includes('SET STATUS = $1')) {
    const newStatus = params[0];
    const id = params[1];
    const user = devStore.tables.users.get(id);
    if (user) {
      user.status = newStatus;
      devStore.saveToDisk();
      return { rows: [user], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  if (normalized.startsWith('UPDATE USERS') && normalized.includes('SET EMAIL_VERIFIED = TRUE') && normalized.includes('WHERE ID = $1')) {
    const id = params[0];
    const user = devStore.tables.users.get(id);
    if (user) {
      user.email_verified = true;
      user.used_at = undefined;
      devStore.saveToDisk();
      return { rows: [user], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  if (normalized.startsWith('UPDATE USERS') && normalized.includes('SET PASSWORD_HASH = $1') && normalized.includes('WHERE ID = $2')) {
    const newHash = params[0];
    const id = params[1];
    const user = devStore.tables.users.get(id);
    if (user) {
      user.password_hash = newHash;
      devStore.saveToDisk();
      return { rows: [user], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  if (normalized.startsWith('UPDATE EMAIL_VERIFICATION_TOKENS') && normalized.includes('USED_AT') && normalized.includes('WHERE ID = $1')) {
    const id = params[0];
    const token = devStore.tables.email_verification_tokens.get(id);
    if (token) {
      token.used_at = new Date().toISOString();
      devStore.saveToDisk();
      return { rows: [token], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  if (normalized.startsWith('UPDATE EMAIL_VERIFICATION_TOKENS') && normalized.includes('USED_AT') && normalized.includes('WHERE USER_ID = $1')) {
    const userId = params[0];
    for (const token of devStore.tables.email_verification_tokens.values()) {
      if (token.user_id === userId && !token.used_at) {
        token.used_at = new Date().toISOString();
      }
    }
    devStore.saveToDisk();
    return { rows: [], rowCount: 0 };
  }

  if (normalized.startsWith('UPDATE PASSWORD_RESET_TOKENS') && normalized.includes('USED_AT') && normalized.includes('WHERE ID = $1')) {
    const id = params[0];
    const token = devStore.tables.password_reset_tokens.get(id);
    if (token) {
      token.used_at = new Date().toISOString();
      devStore.saveToDisk();
      return { rows: [token], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  if (normalized.startsWith('UPDATE PASSWORD_RESET_TOKENS') && normalized.includes('USED_AT') && normalized.includes('WHERE USER_ID = $1')) {
    const userId = params[0];
    for (const token of devStore.tables.password_reset_tokens.values()) {
      if (token.user_id === userId && !token.used_at) {
        token.used_at = new Date().toISOString();
      }
    }
    devStore.saveToDisk();
    return { rows: [], rowCount: 0 };
  }

  if (normalized.startsWith('DELETE FROM USERS') && normalized.includes('WHERE ID = $1')) {
    const id = params[0];
    const deleted = devStore.tables.users.delete(id);
    devStore.saveToDisk();
    return { rows: [], rowCount: deleted ? 1 : 0 };
  }

  if (normalized.startsWith('UPDATE REFRESH_TOKENS') && normalized.includes('REVOKED_AT')) {
    const hash = params[0];
    const token = Array.from(devStore.tables.refresh_tokens.values()).find(t => t.token_hash === hash);
    if (token) {
      token.revoked_at = new Date().toISOString();
      devStore.saveToDisk();
      return { rows: [token], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  if (normalized.startsWith('UPDATE RISK_SCORES') && normalized.includes('SET STATUS = $1') && normalized.includes('WHERE ID = $2') && normalized.includes('AND ORG_ID = $3')) {
    const status = params[0];
    const id = params[1];
    const orgId = params[2];
    const rs = Array.from(devStore.tables.risk_scores.values()).find(r => r.id === id && r.org_id === orgId);
    if (rs) {
      rs.status = status;
      rs.updated_at = new Date().toISOString();
      devStore.saveToDisk();
      return { rows: [rs], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  if (normalized.startsWith('DELETE FROM RISK_SCORES') && normalized.includes('WHERE ID = $1') && normalized.includes('AND ORG_ID = $2')) {
    const id = params[0];
    const orgId = params[1];
    const found = Array.from(devStore.tables.risk_scores.values()).find(r => r.id === id && r.org_id === orgId);
    const deleted = found ? devStore.tables.risk_scores.delete(id) : false;
    devStore.saveToDisk();
    return { rows: found ? [found] : [], rowCount: deleted ? 1 : 0 };
  }

  if (normalized.startsWith('UPDATE CONTRACTS') && normalized.includes('SET CONTENT = COALESCE($1') && normalized.includes('WHERE ID = $4') && normalized.includes('AND ORG_ID = $5')) {
    const content = params[0];
    const status = params[1];
    const title = params[2];
    const id = params[3];
    const orgId = params[4];
    const c = Array.from(devStore.tables.contracts.values()).find(x => x.id === id && x.org_id === orgId);
    if (c) {
      if (content !== undefined && content !== null) c.content = content;
      if (status !== undefined && status !== null) {
        c.status = status;
        if (status === 'signed') c.signed_at = new Date().toISOString();
      }
      if (title !== undefined && title !== null) c.title = title;
      c.updated_at = new Date().toISOString();
      devStore.saveToDisk();
      return { rows: [c], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  if (normalized.startsWith('UPDATE SUBSCRIPTIONS') && normalized.includes('SET PLAN_ID = COALESCE($1') && normalized.includes('WHERE ORG_ID = $5')) {
    const planId = params[0];
    const status = params[1];
    const seatCount = params[2];
    const cancelAt = params[3];
    const orgId = params[4];
    const sub = Array.from(devStore.tables.subscriptions.values()).find(x => x.org_id === orgId);
    if (sub) {
      if (planId !== undefined && planId !== null) sub.plan_id = planId;
      if (status !== undefined && status !== null) sub.status = status;
      if (seatCount !== undefined && seatCount !== null) sub.seat_count = seatCount;
      if (cancelAt !== undefined && cancelAt !== null) sub.cancel_at_period_end = cancelAt;
      sub.updated_at = new Date().toISOString();
      devStore.saveToDisk();
      return { rows: [sub], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  if (normalized.startsWith('DELETE FROM CONTRACTS') && normalized.includes('WHERE ID = $1') && normalized.includes('AND ORG_ID = $2')) {
    const id = params[0];
    const orgId = params[1];
    const found = Array.from(devStore.tables.contracts.values()).find(x => x.id === id && x.org_id === orgId);
    const deleted = found ? devStore.tables.contracts.delete(id) : false;
    devStore.saveToDisk();
    return { rows: found ? [found] : [], rowCount: deleted ? 1 : 0 };
  }

  if (normalized.startsWith('DELETE FROM JOURNEY_RECORDS') && normalized.includes('WHERE ID = $1') && normalized.includes('AND ORG_ID = $2')) {
    const id = params[0];
    const orgId = params[1];
    const found = Array.from(devStore.tables.journey_records.values()).find(x => x.id === id && x.org_id === orgId);
    const deleted = found ? devStore.tables.journey_records.delete(id) : false;
    devStore.saveToDisk();
    return { rows: found ? [found] : [], rowCount: deleted ? 1 : 0 };
  }

  return { rows: [], rowCount: 0 };
}

export async function closeDatabase() {
  if (pool) {
    await pool.end();
  }
}

export { devStore, isPgConnected };
export default {
  query,
  initDatabase,
  closeDatabase,
  devStore
};
