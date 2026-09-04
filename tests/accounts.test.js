import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../server/server.js';
import { seedInitialAccounts, DEMO_DEFAULT_PASSWORD } from '../seeds/demo_accounts.js';

describe('API de Gestão de Contas Hierárquicas (/api/accounts)', () => {
  let adminToken;      // Super admin Leal.ai (vê todos os tenants)
  let escritorioToken; // Dra. Maria (Oliviera & Medeiros, tier-1)
  let techflowToken;   // Marcos (TechFlow, tier-1)
  let techflowAccount;
  let escritorioAccount;

  async function login(email) {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password: DEMO_DEFAULT_PASSWORD });
    expect(res.status).toBe(200);
    return res.body.accessToken;
  }

  beforeAll(async () => {
    await seedInitialAccounts();
    adminToken = await login('admin@leal.ai');
    escritorioToken = await login('dra.maria.oliveira@oliveiramedeiros.adv.br');
    techflowToken = await login('marcos@techflow.io');
  });

  describe('Proteção de Acesso (Segurança)', () => {
    it('GET /api/accounts SEM token deve retornar 401', async () => {
      const res = await request(app).get('/api/accounts');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('GET /api/accounts/stats SEM token deve retornar 401', async () => {
      const res = await request(app).get('/api/accounts/stats');
      expect(res.status).toBe(401);
    });

    it('POST /api/accounts SEM token deve retornar 401', async () => {
      const res = await request(app).post('/api/accounts').send({});
      expect(res.status).toBe(401);
    });

    it('PATCH /api/accounts/:id/status SEM token deve retornar 401', async () => {
      const res = await request(app).patch('/api/accounts/qualquer-id/status').send({ status: 'disabled' });
      expect(res.status).toBe(401);
    });

    it('DELETE /api/accounts/:id SEM token deve retornar 401', async () => {
      const res = await request(app).delete('/api/accounts/qualquer-id');
      expect(res.status).toBe(401);
    });

    it('POST /api/accounts sem permissão team_manage deve retornar 403 (tier-5)', async () => {
      const tier5Token = await login('thiago.nogueira.pj@techflow.io');
      const res = await request(app)
        .post('/api/accounts')
        .set('Authorization', `Bearer ${tier5Token}`)
        .send({
          name: 'Sem Permissão',
          email: 'semperm@leal.ai',
          organization: 'Hack',
          cnpjCpf: '45.123.456/0001-89',
          category: 'empresa',
          role: 'analista_dp',
          tier: 'tier-3',
          sector: 'RH'
        });
      expect(res.status).toBe(403);
    });
  });

  describe('Isolamento Multi-Tenant', () => {
    it('Usuário de um tenant não deve ver contas de outro tenant', async () => {
      const res = await request(app)
        .get('/api/accounts')
        .set('Authorization', `Bearer ${escritorioToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.every(a => a.organization === 'Oliveira & Medeiros Sociedade de Advogados')).toBe(true);
    });

    it('Admin (leal_admin) deve enxergar todos os tenants', async () => {
      const res = await request(app)
        .get('/api/accounts')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const orgs = new Set(res.body.data.map(a => a.organization));
      expect(orgs.size).toBeGreaterThanOrEqual(5);
    });

    it('Usuário de outro tenant não deve acessar a conta de um tenant alheio', async () => {
      // Busca uma conta do TechFlow
      const techRes = await request(app)
        .get('/api/accounts')
        .set('Authorization', `Bearer ${techflowToken}`);
      techflowAccount = techRes.body.data.find(a => a.name === 'Marques Leal Guimarães' || a.name === 'Marcos Leal Guimarães');
      if (!techflowAccount) techflowAccount = techRes.body.data[0];

      // Escritório tenta acessar conta do TechFlow -> 403 (cross-tenant)
      const res = await request(app)
        .get(`/api/accounts/${techflowAccount.id}`)
        .set('Authorization', `Bearer ${escritorioToken}`);
      expect(res.status).toBe(403);
    });

    it('Usuário deve acessar conta do próprio tenant', async () => {
      const listRes = await request(app)
        .get('/api/accounts')
        .set('Authorization', `Bearer ${escritorioToken}`);
      escritorioAccount = listRes.body.data[0];

      const res = await request(app)
        .get(`/api/accounts/${escritorioAccount.id}`)
        .set('Authorization', `Bearer ${escritorioToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('Usuário de outro tenant não deve alterar status de conta alheia', async () => {
      const res = await request(app)
        .patch(`/api/accounts/${techflowAccount.id}/status`)
        .set('Authorization', `Bearer ${escritorioToken}`)
        .send({ status: 'disabled' });
      expect(res.status).toBe(403);
    });

    it('Usuário comum não deve criar conta em tenant alheio, mesmo forçando organization/cnpjCpf', async () => {
      // Escritório tenta criar conta fornecendo dados de outra organização (TechFlow).
      // A correção deve ignorar esses campos e vincular a conta ao próprio tenant.
      const res = await request(app)
        .post('/api/accounts')
        .set('Authorization', `Bearer ${escritorioToken}`)
        .send({
          name: 'Vínculo Forçado',
          email: 'vinculo.forcado@leal.ai',
          organization: 'TechFlow Tecnologia Ltda',
          cnpjCpf: '33.000.167/0001-01',
          category: 'colaborador',
          role: 'analista_rh',
          tier: 'tier-4',
          sector: 'RH'
        });

      // Criação é permitida (o usuário tem permissão no seu tenant), mas a conta
      // deve pertencer ao tenant do solicitante (Oliveira & Medeiros).
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.organization).toBe('Oliveira & Medeiros Sociedade de Advogados');

      // Limpeza: remove a conta criada para não poluir o estado do teste.
      await request(app)
        .delete(`/api/accounts/${res.body.data.id}`)
        .set('Authorization', `Bearer ${escritorioToken}`);
    });
  });

  describe('Operações CRUD autenticadas', () => {
    it('GET /api/accounts deve retornar lista de contas do tenant autenticado', async () => {
      const res = await request(app)
        .get('/api/accounts')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThanOrEqual(12);
    });

    it('GET /api/accounts/stats deve retornar métricas do ecossistema', async () => {
      const res = await request(app)
        .get('/api/accounts/stats')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.stats.totalAccounts).toBeGreaterThan(0);
      expect(res.body.stats.totalOrganizations).toBeGreaterThan(0);
      expect(res.body.stats.totalLawyers).toBeGreaterThan(0);
    });

    it('POST /api/accounts deve criar uma nova conta válida com UUID e senha hasheada', async () => {
      const newAccountData = {
        name: 'Advogada de Teste Automatizado',
        email: 'teste.advogada@leal.ai',
        organization: 'Banca Jurídica Teste & Associados',
        cnpjCpf: '33.000.167/0001-01', // CNPJ válido
        category: 'escritorio',
        role: 'adv_associado',
        roleName: 'Advogada Associada / Pleno',
        tier: 'tier-3',
        sector: 'Contencioso Trabalhista',
        oab: 'OAB/SP 999.888',
        reportsTo: 'Sócio Coordenador',
        plan: 'Enterprise',
        permissions: ['contracts_create', 'contracts_review']
      };

      const res = await request(app)
        .post('/api/accounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newAccountData);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      // UUID v4 format verification
      expect(res.body.data.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(res.body.data.name).toBe(newAccountData.name);
      expect(res.body.data.tier).toBe('tier-3');
      expect(res.body.temporaryPassword).toBeDefined(); // Gerou senha temporária segura
    });

    it('POST /api/accounts com CPF/CNPJ inválido deve retornar 400 (Zod Validation)', async () => {
      const invalidData = {
        name: 'Usuário Teste Inválido',
        email: 'invalido2@leal.ai',
        organization: 'Empresa Teste',
        cnpjCpf: '111.111.111-11', // CPF inválido
        category: 'empresa',
        role: 'gerente_rh',
        tier: 'tier-2',
        sector: 'RH'
      };

      const res = await request(app)
        .post('/api/accounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidData);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.details[0].message).toContain('CPF ou CNPJ inválido');
    });

    it('PATCH /api/accounts/:id/status deve alterar o status da conta própria do tenant', async () => {
      const listRes = await request(app)
        .get('/api/accounts')
        .set('Authorization', `Bearer ${adminToken}`);
      const targetUser = listRes.body.data[0];

      const res = await request(app)
        .patch(`/api/accounts/${targetUser.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'disabled' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('disabled');
    });

    it('DELETE /api/accounts/:id como admin deve remover a conta', async () => {
      // Cria uma conta para depois excluir
      const created = await request(app)
        .post('/api/accounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Conta a Excluir',
          email: 'excluir@leal.ai',
          organization: 'Leal.ai Tecnologia Jurídica S.A.',
          cnpjCpf: '33.000.167/0001-01',
          category: 'escritorio',
          role: 'estagiario_dir',
          tier: 'tier-4',
          sector: 'Contencioso Trabalhista',
          oab: 'OAB/BA 00.001'
        });

      expect(created.status).toBe(201);
      const createdId = created.body.data.id;

      const delRes = await request(app)
        .delete(`/api/accounts/${createdId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);
    });
  });

  describe('Trilha de Auditoria (/api/audit)', () => {
    it('GET /api/audit SEM token deve retornar 401', async () => {
      const res = await request(app).get('/api/audit');
      expect(res.status).toBe(401);
    });

    it('GET /api/audit como admin deve retornar lista de logs', async () => {
      const res = await request(app)
        .get('/api/audit')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
    });
  });
});
