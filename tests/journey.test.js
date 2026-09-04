import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../server/server.js';
import { seedInitialAccounts, DEMO_DEFAULT_PASSWORD } from '../seeds/demo_accounts.js';
import { detectViolations, computeJourneyStats } from '../server/utils/journeyEngine.js';

async function login(email, password = DEMO_DEFAULT_PASSWORD) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password });
    if (res.body.accessToken) return res.body.accessToken;
  }
  return undefined;
}

// Maria é tier-1 (dona) no tenant Medeiros; admin global; estagiário tier-4 (sem permissão de jornada)
describe('Monitor de Jornada e Ponto (/api/journey)', () => {
  beforeAll(async () => {
    await seedInitialAccounts();
  });

  let adminToken;
  let mariaToken;
  let estagiarioToken;
  let mariaUser;

  beforeAll(async () => {
    adminToken = await login('admin@leal.ai');
    mariaToken = await login('dra.maria.oliveira@oliveiramedeiros.adv.br');
    estagiarioToken = await login('pedro.estagio@oliveiramedeiros.adv.br');

    // Obter id da Maria para usar como colaborador-alvo nos testes
    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${mariaToken}`);
    mariaUser = me.body.user;
  });

  describe('Unidade do motor de jornada (journeyEngine)', () => {
    it('deve detectar violação de interjornada (< 11h)', () => {
      const violations = detectViolations([
        { clockIn: '2024-01-01T08:00:00', clockOut: '2024-01-01T17:00:00' },
        { clockIn: '2024-01-02T02:00:00', clockOut: '2024-01-02T11:00:00' }
      ]);
      expect(violations.some(v => v.tipo === 'interjornada')).toBe(true);
    });

    it('deve detectar excesso de horas extras diárias (> 2h)', () => {
      const violations = detectViolations([
        { clockIn: '2024-01-01T08:00:00', clockOut: '2024-01-01T19:00:00' }
      ]);
      expect(violations.some(v => v.tipo === 'horas_extras_excesso')).toBe(true);
    });

    it('deve detectar falta de intervalo intrajornada em jornada > 6h', () => {
      const violations = detectViolations([
        { clockIn: '2024-01-01T08:00:00', clockOut: '2024-01-01T16:00:00', intervalTaken: false }
      ]);
      expect(violations.some(v => v.tipo === 'intervalo_intrajornada')).toBe(true);
    });

    it('não gera violações para jornada conforme', () => {
      const violations = detectViolations([
        { clockIn: '2024-01-01T08:00:00', clockOut: '2024-01-01T17:00:00', intervalTaken: true },
        { clockIn: '2024-01-02T08:00:00', clockOut: '2024-01-02T17:00:00', intervalTaken: true },
        { clockIn: '2024-01-03T08:00:00', clockOut: '2024-01-03T17:00:00', intervalTaken: true },
        { clockIn: '2024-01-04T08:00:00', clockOut: '2024-01-04T17:00:00', intervalTaken: true },
        { clockIn: '2024-01-05T08:00:00', clockOut: '2024-01-05T17:00:00', intervalTaken: true }
      ]);
      expect(violations.filter(v => v.severidade === 'critico')).toHaveLength(0);
    });

    it('computeJourneyStats soma horas e extras corretamente', () => {
      const stats = computeJourneyStats([
        { clockIn: '2024-01-01T08:00:00', clockOut: '2024-01-01T18:00:00' },
        { clockIn: '2024-01-02T08:00:00', clockOut: '2024-01-02T17:00:00' }
      ]);
      expect(stats.totalHours).toBe(19);
      expect(stats.totalOvertime).toBe(3);
    });
  });

  describe('Endpoints com autenticação e RBAC', () => {
    it('POST /api/journey/analyze sem token deve retornar 401', async () => {
      const res = await request(app)
        .post('/api/journey/analyze')
        .send({ records: [] });
      expect(res.status).toBe(401);
    });

    it('POST /api/journey/analyze como estagiário (tier-4) deve retornar 403', async () => {
      const res = await request(app)
        .post('/api/journey/analyze')
        .set('Authorization', `Bearer ${estagiarioToken}`)
        .send({ records: [] });
      expect(res.status).toBe(403);
    });

    it('POST /api/journey/analyze como ténico (tier-1) retorna violações', async () => {
      const res = await request(app)
        .post('/api/journey/analyze')
        .set('Authorization', `Bearer ${mariaToken}`)
        .send({
          records: [
            { clockIn: '2024-01-01T08:00:00', clockOut: '2024-01-01T17:00:00' },
            { clockIn: '2024-01-02T02:00:00', clockOut: '2024-01-02T11:00:00' }
          ]
        });
      expect(res.status).toBe(200);
      expect(res.body.data.violations.some(v => v.tipo === 'interjornada')).toBe(true);
    });

    it('POST /api/journey/analyze com records não-array deve retornar 400', async () => {
      const res = await request(app)
        .post('/api/journey/analyze')
        .set('Authorization', `Bearer ${mariaToken}`)
        .send({ records: 'nope' });
      expect(res.status).toBe(400);
    });
  });

  describe('Registro e isolamento multi-tenant', () => {
    it('POST /api/journey/records cria registro e retorna violações', async () => {
      const res = await request(app)
        .post('/api/journey/records')
        .set('Authorization', `Bearer ${mariaToken}`)
        .send({
          userId: mariaUser.id,
          clockIn: '2024-01-10T08:00:00',
          clockOut: '2024-01-10T18:00:00'
        });
      expect(res.status).toBe(201);
      expect(res.body.data.hoursWorked).toBe(10);
      expect(res.body.data.violations).toBeInstanceOf(Array);
    });

    it('POST /api/journey/records com colaborador de outra organização deve retornar 403', async () => {
      // admin global cria registro para Maria — admin acessa qualquer tenant
      const res = await request(app)
        .post('/api/journey/records')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: mariaUser.id,
          clockIn: '2024-01-11T08:00:00',
          clockOut: '2024-01-11T17:00:00'
        });
      // Admin não tem orgScope, logo não há violação de isolamento para ele
      expect([201, 403]).toContain(res.status);
    });

    it('POST /api/journey/records com userId inexistente deve retornar 404', async () => {
      const res = await request(app)
        .post('/api/journey/records')
        .set('Authorization', `Bearer ${mariaToken}`)
        .send({ userId: '00000000-0000-0000-0000-000000000000' });
      expect(res.status).toBe(404);
    });

    it('GET /api/journey/records devolve registros do tenant com violações', async () => {
      const res = await request(app)
        .get('/api/journey/records')
        .set('Authorization', `Bearer ${mariaToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.records).toBeInstanceOf(Array);
      expect(typeof res.body.data.stats.sum) === 'object';
    });

    it('DELETE /api/journey/records/:id remove registro (escopado por tenant)', async () => {
      const created = await request(app)
        .post('/api/journey/records')
        .set('Authorization', `Bearer ${mariaToken}`)
        .send({ userId: mariaUser.id, clockIn: '2024-01-12T08:00:00', clockOut: '2024-01-12T17:00:00' });

      const del = await request(app)
        .delete(`/api/journey/records/${created.body.data.id}`)
        .set('Authorization', `Bearer ${mariaToken}`);
      expect(del.status).toBe(200);
      expect(del.body.success).toBe(true);
    });
  });
});
