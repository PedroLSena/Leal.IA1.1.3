import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../server/server.js';
import { seedInitialAccounts, DEMO_DEFAULT_PASSWORD } from '../seeds/demo_accounts.js';

describe('API de Autenticação JWT (/api/auth)', () => {
  beforeAll(async () => {
    await seedInitialAccounts();
  });

  it('POST /api/auth/login com credenciais corretas deve retornar tokens JWT e dados do usuário', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'dra.maria.oliveira@oliveiramedeiros.adv.br',
        password: DEMO_DEFAULT_PASSWORD
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe('dra.maria.oliveira@oliveiramedeiros.adv.br');
    expect(res.body.user.tier).toBe('tier-1');
    expect(res.body.user.password_hash).toBeUndefined(); // Proteção: nunca expõe hash
  });

  it('POST /api/auth/login com senha incorreta deve retornar status 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'dra.maria.oliveira@oliveiramedeiros.adv.br',
        password: 'SenhaTotalmenteErrada123!'
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/auth/login com email inexistente deve retornar status 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'naoexiste@leal.ai',
        password: 'qualquersenha'
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/auth/refresh com token válido deve rotacionar e emitir novo par de tokens', async () => {
    // 1. Faz login para obter refresh token inicial
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'marcos@techflow.io',
        password: DEMO_DEFAULT_PASSWORD
      });

    const { refreshToken } = loginRes.body;

    // 2. Chama rota de refresh
    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.success).toBe(true);
    expect(refreshRes.body.accessToken).toBeDefined();
    expect(refreshRes.body.refreshToken).toBeDefined();
    expect(refreshRes.body.refreshToken).not.toBe(refreshToken); // Rotação confirmada
  });

  it('GET /api/auth/me sem token deve retornar 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/me com Bearer token válido deve retornar perfil e permissões', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@leal.ai',
        password: DEMO_DEFAULT_PASSWORD
      });

    const token = loginRes.body.accessToken;

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.email).toBe('admin@leal.ai');
    expect(res.body.user.permissions).toBeInstanceOf(Array);
  });
});
