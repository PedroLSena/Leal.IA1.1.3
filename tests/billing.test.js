import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../server/server.js';
import { seedInitialAccounts, DEMO_DEFAULT_PASSWORD } from '../seeds/demo_accounts.js';
import { Subscription } from '../server/models/Subscription.js';
import { Invoice } from '../server/models/Invoice.js';

async function login(email, password = DEMO_DEFAULT_PASSWORD) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password });
    if (res.body.accessToken) return res.body.accessToken;
  }
  return undefined;
}

describe('Billing e Assinaturas (/api/billing)', () => {
  beforeAll(async () => {
    await seedInitialAccounts();
  });

  let adminToken;
  let mariaToken;
  let estagiarioToken;
  let mariaId;
  let mariaOrgId;

  beforeAll(async () => {
    adminToken = await login('admin@leal.ai');
    mariaToken = await login('dra.maria.oliveira@oliveiramedeiros.adv.br');
    estagiarioToken = await login('pedro.estagio@oliveiramedeiros.adv.br');

    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${mariaToken}`);
    mariaId = me.body.user.id;
    mariaOrgId = me.body.user.org_id || me.body.user.orgId;
  });

  describe('Catálogo de planos', () => {
    it('Subscription.listPlans contém os três planos', () => {
      const plans = Subscription.listPlans();
      expect(plans.map(p => p.id)).toEqual(expect.arrayContaining(['starter', 'pro', 'enterprise']));
    });

    it('GET /api/billing/plans retorna catálogo para tier-1', async () => {
      const res = await request(app)
        .get('/api/billing/plans')
        .set('Authorization', `Bearer ${mariaToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(3);
      const pro = res.body.data.find(p => p.id === 'pro');
      expect(pro.priceMonthlyBRL).toBe(299);
    });
  });

  describe('Endpoints com autenticação e RBAC', () => {
    it('GET /api/billing/subscription sem token deve retornar 401', async () => {
      const res = await request(app).get('/api/billing/subscription');
      expect(res.status).toBe(401);
    });

    it('GET /api/billing/subscription como estagiário (tier-4) deve retornar 403', async () => {
      const res = await request(app)
        .get('/api/billing/subscription')
        .set('Authorization', `Bearer ${estagiarioToken}`);
      expect(res.status).toBe(403);
    });

    it('GET /api/billing/subscription como tier-1 cria assinatura trial', async () => {
      const res = await request(app)
        .get('/api/billing/subscription')
        .set('Authorization', `Bearer ${mariaToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.subscription).toBeDefined();
      expect(res.body.data.subscription.status).toBe('trial');
      expect(res.body.data.subscription.org_id).toBe(mariaOrgId);
      expect(res.body.data.invoices).toBeInstanceOf(Array);
    });

    it('PATCH /api/billing/subscription atualiza plano e status', async () => {
      const res = await request(app)
        .patch('/api/billing/subscription')
        .set('Authorization', `Bearer ${mariaToken}`)
        .send({ planId: 'enterprise', status: 'active' });
      expect(res.status).toBe(200);
      expect(res.body.data.plan_id).toBe('enterprise');
      expect(res.body.data.status).toBe('active');
    });

    it('PATCH /api/billing/subscription com plano inválido retorna 400', async () => {
      const res = await request(app)
        .patch('/api/billing/subscription')
        .set('Authorization', `Bearer ${mariaToken}`)
        .send({ planId: 'gold' });
      expect(res.status).toBe(400);
    });
  });

  describe('Faturas e isolamento', () => {
    it('Invoice.create e listByOrg funcionam no dev store', async () => {
      const inv = await Invoice.create({
        orgId: mariaOrgId,
        subscriptionId: null,
        amountBRL: 999,
        status: 'paid'
      });
      const list = await Invoice.listByOrg(mariaOrgId);
      expect(list.some(i => i.id === inv.id)).toBe(true);
    });

    it('GET /api/billing/subscription como admin global vê assinatura da org da Maria', async () => {
      // Admin (super admin) com billing_view acessa qualquer tenant
      const res = await request(app)
        .get('/api/billing/subscription')
        .set('Authorization', `Bearer ${adminToken}`);
      // Admin não tem org própria; usa req.user.orgId via admin user
      expect(res.status).toBe(200);
      expect(res.body.data.subscription).toBeDefined();
    });
  });
});
