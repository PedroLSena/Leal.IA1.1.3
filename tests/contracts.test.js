import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../server/server.js';
import { seedInitialAccounts, DEMO_DEFAULT_PASSWORD } from '../seeds/demo_accounts.js';
import { generateCltContract } from '../server/utils/contractEngine.js';

async function login(email, password = DEMO_DEFAULT_PASSWORD) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password });
    if (res.body.accessToken) return res.body.accessToken;
  }
  return undefined;
}

describe('Gerador de Contratos Trabalhistas (/api/contracts)', () => {
  beforeAll(async () => {
    await seedInitialAccounts();
  });

  let adminToken;
  let mariaToken;
  let estagiarioToken;

  beforeAll(async () => {
    adminToken = await login('admin@leal.ai');
    mariaToken = await login('dra.maria.oliveira@oliveiramedeiros.adv.br');
    estagiarioToken = await login('pedro.estagio@oliveiramedeiros.adv.br');
  });

  describe('Unidade do motor de contratos (contractEngine)', () => {
    it('deve gerar uma minuta CLT com cláusulas obrigatórias', () => {
      const result = generateCltContract({
        nomeTrabalhador: 'João da Silva',
        cargo: 'Analista',
        empresa: 'Leal SaaS Ltda',
        salarioBase: 3500,
        cidade: 'São Paulo'
      });
      expect(result.content).toContain('João da Silva');
      expect(result.content).toContain('Analista');
      expect(result.content).toContain('CONTRATO DE TRABALHO');
      expect(result.content).toContain('CLÁUSULA');
      expect(result.warnings).toHaveLength(0);
    });

    it('deve alertar risco crítico de pejotização quando regime é PJ', () => {
      const result = generateCltContract({ regime: 'pj' });
      const pj = result.warnings.find(w => w.tipo === 'pejotizacao');
      expect(pj).toBeDefined();
      expect(pj.severidade).toBe('critico');
    });

    it('deve alertar salário abaixo do mínimo vigente', () => {
      const result = generateCltContract({ salarioBase: 800 });
      expect(result.warnings.some(w => w.tipo === 'piso_salarial')).toBe(true);
    });

    it('deve formatar salário em Real brasileiro', () => {
      const result = generateCltContract({ salarioBase: 2500.5 });
      expect(result.content).toContain('R$');
    });
  });

  describe('Endpoints com autenticação e RBAC', () => {
    it('POST /api/contracts/generate sem token deve retornar 401', async () => {
      const res = await request(app)
        .post('/api/contracts/generate')
        .send({ nomeTrabalhador: 'X', cargo: 'Y', empresa: 'Z' });
      expect(res.status).toBe(401);
    });

    it('POST /api/contracts/generate como admin deve gerar contrato', async () => {
      const res = await request(app)
        .post('/api/contracts/generate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          tipo: 'clt',
          nomeTrabalhador: 'Carlos Souza',
          cargo: 'Operador de Produção',
          empresa: 'Leal SaaS Ltda',
          salarioBase: 2000,
          cidade: 'Campinas'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.content).toContain('Carlos Souza');
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.warnings).toBeInstanceOf(Array);
    });

    it('POST /api/contracts/generate com dados inválidos deve retornar 400', async () => {
      const res = await request(app)
        .post('/api/contracts/generate')
        .set('Authorization', `Bearer ${mariaToken}`)
        .send({ nomeTrabalhador: 'A' });
      expect(res.status).toBe(400);
    });
  });

  describe('Isolamento multi-tenant e CRUD', () => {
    it('GET /api/contracts devolve apenas contratos do tenant', async () => {
      const created = await request(app)
        .post('/api/contracts/generate')
        .set('Authorization', `Bearer ${mariaToken}`)
        .send({ nomeTrabalhador: 'Ana Paula', cargo: 'Recepcionista', empresa: 'Medeiros Adv' });
      expect(created.status).toBe(201);

      const list = await request(app)
        .get('/api/contracts')
        .set('Authorization', `Bearer ${mariaToken}`);
      expect(list.status).toBe(200);
      expect(Array.isArray(list.body.data)).toBe(true);
      expect(list.body.data.map(i => i.title)).toContain(created.body.data.title);
    });

    it('GET /api/contracts com id de outra organização deve retornar 404 (isolamento)', async () => {
      const res = await request(app)
        .get('/api/contracts/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${mariaToken}`);
      expect(res.status).toBe(404);
    });

    it('PATCH /api/contracts/:id atualiza status (escopado por tenant)', async () => {
      const created = await request(app)
        .post('/api/contracts/generate')
        .set('Authorization', `Bearer ${mariaToken}`)
        .send({ nomeTrabalhador: 'Bruno', cargo: 'Coordenador', empresa: 'Medeiros Adv' });

      const patch = await request(app)
        .patch(`/api/contracts/${created.body.data.id}`)
        .set('Authorization', `Bearer ${mariaToken}`)
        .send({ status: 'signed' });

      expect(patch.status).toBe(200);
      expect(patch.body.data.status).toBe('signed');
    });

    it('DELETE /api/contracts/:id remove contrato (escopado por tenant)', async () => {
      const created = await request(app)
        .post('/api/contracts/generate')
        .set('Authorization', `Bearer ${mariaToken}`)
        .send({ nomeTrabalhador: 'Carla', cargo: 'Assistente', empresa: 'Medeiros Adv' });

      const del = await request(app)
        .delete(`/api/contracts/${created.body.data.id}`)
        .set('Authorization', `Bearer ${mariaToken}`);
      expect(del.status).toBe(200);
      expect(del.body.success).toBe(true);
    });
  });
});
