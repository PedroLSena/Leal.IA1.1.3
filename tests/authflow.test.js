import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../server/server.js';
import { seedInitialAccounts, DEMO_DEFAULT_PASSWORD } from '../seeds/demo_accounts.js';

describe('API de Fluxo de Autenticação Completo (/api/auth)', () => {
  beforeAll(async () => {
    await seedInitialAccounts();
  });

  let registeredEmail;
  let verificationToken;
  let resetToken;

  describe('Auto-registro (self-onboarding)', () => {
    it('POST /api/auth/register deve criar conta e retornar usuário tier-1', async () => {
      registeredEmail = `nova.empresa.${Date.now()}@empresa.com.br`;
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'João Silva',
          email: registeredEmail,
          password: 'SenhaForte#2026',
          organization: 'Empresa Nova Ltda.',
          cnpjCpf: '33.000.167/0001-01',
          category: 'empresa',
          sector: 'TI'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(registeredEmail);
      expect(res.body.user.tier).toBe('tier-1');
      expect(res.body.verificationToken).toBeDefined();
      verificationToken = res.body.verificationToken;
    });

    it('POST /api/auth/register com e-mail duplicado deve retornar 409', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Outro Nome',
          email: registeredEmail,
          password: 'SenhaForte#2026',
          organization: 'Outra Empresa',
          cnpjCpf: '33.000.167/0001-01',
          category: 'empresa',
          sector: 'TI'
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('POST /api/auth/register com senha fraca deve retornar 400', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Teste',
          email: 'fraca@empresa.com.br',
          password: '123',
          organization: 'Empresa Fraca',
          cnpjCpf: '33.000.167/0001-01',
          category: 'empresa',
          sector: 'TI'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('POST /api/auth/register com CNPJ inválido deve retornar 400', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Teste',
          email: 'cnpjadmin@empresa.com.br',
          password: 'SenhaForte#2026',
          organization: 'Empresa CNPJ',
          cnpjCpf: '11.111.111/1111-11',
          category: 'empresa',
          sector: 'TI'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Verificação de e-mail', () => {
    it('POST /api/auth/verify-email com token válido deve marcar como verificado', async () => {
      const res = await request(app)
        .post('/api/auth/verify-email')
        .send({ token: verificationToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('POST /api/auth/verify-email com token inválido deve retornar 400', async () => {
      const res = await request(app)
        .post('/api/auth/verify-email')
        .send({ token: 'token-invalido-aleatorio' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Recuperação de senha', () => {
    it('POST /api/auth/forgot-password deve aceitar e-mail cadastrado (resposta genérica)', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: registeredEmail });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.resetToken).toBeDefined();
      resetToken = res.body.resetToken;
    });

    it('POST /api/auth/forgot-password para e-mail inexistente NÃO deve revelar existência', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nao-cadastrado@empresa.com.br' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Não deve expor token para e-mail inexistente
      expect(res.body.resetToken).toBeUndefined();
    });

    it('POST /api/auth/reset-password com token válido deve redefinir a senha', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: resetToken, password: 'NovaSenhaForte%2026' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('Login com a nova senha redefinida deve funcionar', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: registeredEmail, password: 'NovaSenhaForte%2026' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.accessToken).toBeDefined();
    });

    it('POST /api/auth/reset-password com token inválido deve retornar 400', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'token-inexistente', password: 'NovaSenhaForte%2026' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Troca de senha (autenticado)', () => {
    it('POST /api/auth/change-password sem token deve retornar 401', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .send({ currentPassword: DEMO_DEFAULT_PASSWORD, newPassword: 'NovaSenhaForte%2027' });

      expect(res.status).toBe(401);
    });

    it('POST /api/auth/change-password com senha atual correta deve alterar a senha', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: registeredEmail, password: 'NovaSenhaForte%2026' });

      const token = loginRes.body.accessToken;

      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'NovaSenhaForte%2026', newPassword: 'NovaSenhaTrocada%2027' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('Login com a nova senha trocada deve funcionar', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: registeredEmail, password: 'NovaSenhaTrocada%2027' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('POST /api/auth/change-password com senha atual incorreta deve retornar 400', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: registeredEmail, password: 'NovaSenhaTrocada%2027' });

      const token = loginRes.body.accessToken;

      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'SenhaErrada', newPassword: 'SenhaNova#2026' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});
