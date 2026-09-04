import { describe, it, expect } from 'vitest';
import {
  generateSecurePassword,
  hashPassword,
  comparePassword,
  validatePasswordStrength
} from '../server/utils/passwordGenerator.js';

describe('Gerador e Validador de Senhas Seguras', () => {
  describe('generateSecurePassword', () => {
    it('deve gerar senha com no mínimo 16 caracteres por padrão', () => {
      const pwd = generateSecurePassword();
      expect(pwd.length).toBeGreaterThanOrEqual(16);
    });

    it('deve respeitar comprimento solicitado', () => {
      const pwd = generateSecurePassword(24);
      expect(pwd.length).toBe(24);
    });

    it('deve conter maiúsculas, minúsculas, números e caracteres especiais', () => {
      const pwd = generateSecurePassword(20);
      expect(/[A-Z]/.test(pwd)).toBe(true);
      expect(/[a-z]/.test(pwd)).toBe(true);
      expect(/[0-9]/.test(pwd)).toBe(true);
      expect(/[!@#$%^&*()_\-+=\[\]{};':"\\|,.<>\/?]/.test(pwd)).toBe(true);
    });
  });

  describe('hashPassword e comparePassword (bcrypt)', () => {
    it('deve gerar hash bcrypt válido e validar comparação correta', async () => {
      const plain = 'MinhaSenhaForte@2026';
      const hash = await hashPassword(plain);

      expect(hash).toBeDefined();
      expect(hash.startsWith('$2')).toBe(true); // Prefixo padrão bcrypt
      expect(hash).not.toBe(plain);

      const isValid = await comparePassword(plain, hash);
      expect(isValid).toBe(true);

      const isWrong = await comparePassword('SenhaIncorreta@123', hash);
      expect(isWrong).toBe(false);
    });
  });

  describe('validatePasswordStrength', () => {
    it('deve aprovar senhas fortes e completas', () => {
      const result = validatePasswordStrength('Leal#Tech2026Juridico!');
      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('deve reprovar senhas fracas listando as razões', () => {
      const result = validatePasswordStrength('12345');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });
  });
});
