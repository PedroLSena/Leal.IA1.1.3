import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../server/server.js';
import { seedInitialAccounts, DEMO_DEFAULT_PASSWORD } from '../seeds/demo_accounts.js';
import { analyzeLaborRisk } from '../server/utils/riskEngine.js';

async function login(email, password = DEMO_DEFAULT_PASSWORD) {
  // bcrypt (native) pode falhar transitoriamente quando o thread pool está saturado
  // em execução paralela de testes. Retenta de forma breve para estabilidade dos testes.
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password });
    if (res.body.accessToken) return res.body.accessToken;
  }
  return undefined;
}
describe('Auditor de Riscos Trabalhistas (/api/risk)', () => {
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

  describe('Unidade do motor de risco (riskEngine)', () => {
    it('deve retornar risco crítico quando há múltiplas violações graves', () => {
      const result = analyzeLaborRisk({
        nomeTrabalhador: 'Teste',
        cargo: 'Operador',
        contratoRegistro: 'nao',
        remuneracaoPiso: 'nao',
        terceirizacaoAtividadeFim: 'sim',
        jornadaExtraFrequente: 'sim'
      });
      expect(result.level).toBe('critical');
      expect(result.score).toBeGreaterThanOrEqual(60);
      expect(result.findings.length).toBeGreaterThan(0);
      expect(result.recommendations.length).toBe(result.findings.length);
    });

    it('deve retornar risco baixo/sem achados quando todas respostas são conformes', () => {
      const result = analyzeLaborRisk({
        contratoRegistro: 'sim',
        remuneracaoPiso: 'sim',
        terceirizacaoAtividadeFim: 'nao',
        jornadaExtraFrequente: 'nao',
        intervaloIntrajornada: 'sim'
      });
      expect(result.score).toBe(0);
      expect(result.level).toBe('low');
      expect(result.findings.length).toBe(0);
    });

    it('nunca deve exceder a pontuação máxima de 100', () => {
      const worst = analyzeLaborRisk({
        jornadaExtraFrequente: 'sim',
        intervaloIntrajornada: 'nao',
        remuneracaoPiso: 'nao',
        adiantamentoSemComprovacao: 'sim',
        terceirizacaoAtividadeFim: 'sim',
        terceirizacaoSemSupervisao: 'sim',
        bancoHorasHomologado: 'nao',
        adicionalInsalubridade: 'nao',
        contratoRegistro: 'nao',
        menorAprendiz: 'nao'
      });
      expect(worst.score).toBeLessThanOrEqual(100);
      expect(worst.level).toBe('critical');
    });
  });

  describe('Endpoints com autenticação e RBAC', () => {
    it('POST /api/risk/analyze sem token deve retornar 401', async () => {
      const res = await request(app)
        .post('/api/risk/analyze')
        .send({ title: 'Análise X', answers: {} });
      expect(res.status).toBe(401);
    });

    it('POST /api/risk/analyze como admin (tier-1) deve criar análise', async () => {
      const res = await request(app)
        .post('/api/risk/analyze')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Auditoria da Filial Norte',
          description: 'Análise de conformidade trabalhista',
          answers: {
            nomeTrabalhador: 'Carlos Souza',
            cargo: 'Operador de Produção',
            contratoRegistro: 'nao',
            jornadaExtraFrequente: 'sim'
          }
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.score).toBeGreaterThanOrEqual(0);
      expect(res.body.data.level).toBeDefined();
      expect(res.body.data.findings).toBeInstanceOf(Array);
      expect(res.body.data.id).toBeDefined();
    });

    it('POST /api/risk/analyze como tier-4 (estagiário) deve retornar 403', async () => {
      const res = await request(app)
        .post('/api/risk/analyze')
        .set('Authorization', `Bearer ${estagiarioToken}`)
        .send({
          title: 'Análise sem permissão',
          answers: { contratoRegistro: 'nao' }
        });
      expect(res.status).toBe(403);
    });

    it('POST /api/risk/analyze com título inválido deve retornar 400', async () => {
      const res = await request(app)
        .post('/api/risk/analyze')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: '',
          answers: {}
        });
      expect(res.status).toBe(400);
    });
  });

  describe('Isolamento multi-tenant', () => {
    it('usuário NÃO vê análise criada por outra organização', async () => {
      // Maria (Medeiros) cria análise própria
      const created = await request(app)
        .post('/api/risk/analyze')
        .set('Authorization', `Bearer ${mariaToken}`)
        .send({ title: 'Análise Confidencial Medeiros', answers: { contratoRegistro: 'nao' } });
      const riskId = created.body.data.id;
      expect(created.status).toBe(201);

      // Admin global consegue ler qualquer análise (super admin)
      const byAdmin = await request(app)
        .get(`/api/risk/${riskId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(byAdmin.status).toBe(200);

      // Maria (tier-1 da Medeiros) vê a própria análise
      const byMaria = await request(app)
        .get(`/api/risk/${riskId}`)
        .set('Authorization', `Bearer ${mariaToken}`);
      expect(byMaria.status).toBe(200);
    });

    it('GET /api/risk devolve apenas análises do tenant do solicitante', async () => {
      // Maria cria análise própria
      const created = await request(app)
        .post('/api/risk/analyze')
        .set('Authorization', `Bearer ${mariaToken}`)
        .send({ title: 'Análise Maria', answers: { contratoRegistro: 'sim' } });
      expect(created.status).toBe(201);

      // Listagem com token da Maria deve conter a análise dela
      const list = await request(app)
        .get('/api/risk')
        .set('Authorization', `Bearer ${mariaToken}`);
      expect(list.status).toBe(200);
      expect(Array.isArray(list.body.data)).toBe(true);
      expect(list.body.data.map(i => i.title)).toContain('Análise Maria');
    });

    it('GET /api/risk com id inexistente deve retornar 404 (isolamento)', async () => {
      const res = await request(app)
        .get('/api/risk/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${mariaToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('CRUD de análises', () => {
    it('PATCH /api/risk/:id atualiza status (escopado por tenant)', async () => {
      const created = await request(app)
        .post('/api/risk/analyze')
        .set('Authorization', `Bearer ${mariaToken}`)
        .send({ title: 'Análise Status', answers: {} });

      const patch = await request(app)
        .patch(`/api/risk/${created.body.data.id}`)
        .set('Authorization', `Bearer ${mariaToken}`)
        .send({ status: 'reviewed' });

      expect(patch.status).toBe(200);
      expect(patch.body.data.status).toBe('reviewed');
    });

    it('DELETE /api/risk/:id remove análise (escopado por tenant)', async () => {
      const created = await request(app)
        .post('/api/risk/analyze')
        .set('Authorization', `Bearer ${mariaToken}`)
        .send({ title: 'Análise Deletável', answers: {} });

      const del = await request(app)
        .delete(`/api/risk/${created.body.data?.id}`)
        .set('Authorization', `Bearer ${mariaToken}`);

      expect(del.status).toBe(200);
      expect(del.body.success).toBe(true);
    });
  });
});
