import { describe, it, expect } from 'vitest';
import {
  cleanDigits,
  validateCPF,
  validateCNPJ,
  validateCpfCnpj,
  formatCPF,
  formatCNPJ,
  formatCpfCnpj
} from '../server/utils/cpfCnpjValidator.js';

describe('Validador de CPF e CNPJ (Regras da Receita Federal)', () => {
  describe('cleanDigits', () => {
    it('deve remover pontos, traços, barras e espaços', () => {
      expect(cleanDigits('123.456.789-00')).toBe('12345678900');
      expect(cleanDigits(' 12.345.678/0001-90 ')).toBe('12345678000190');
      expect(cleanDigits('')).toBe('');
      expect(cleanDigits(null)).toBe('');
    });
  });

  describe('validateCPF', () => {
    it('deve validar CPFs válidos com dígitos verificadores corretos', () => {
      // CPFs válidos conhecidos para teste algorítmico
      expect(validateCPF('52998224725')).toBe(true);
      expect(validateCPF('529.982.247-25')).toBe(true);
      expect(validateCPF('31987654000')).toBe(false); // Dígito inválido
    });

    it('deve rejeitar sequências de dígitos repetidos conhecidas', () => {
      expect(validateCPF('000.000.000-00')).toBe(false);
      expect(validateCPF('111.111.111-11')).toBe(false);
      expect(validateCPF('222.222.222-22')).toBe(false);
      expect(validateCPF('999.999.999-99')).toBe(false);
    });

    it('deve rejeitar comprimentos incorretos', () => {
      expect(validateCPF('123456789')).toBe(false);
      expect(validateCPF('123456789012')).toBe(false);
    });
  });

  describe('validateCNPJ', () => {
    it('deve validar CNPJs válidos com cálculo módulo 11', () => {
      // CNPJ da Petrobras (exemplo público real da Receita Federal)
      expect(validateCNPJ('33.000.167/0001-01')).toBe(true);
      expect(validateCNPJ('33000167000101')).toBe(true);
    });

    it('deve rejeitar CNPJs com dígitos verificadores incorretos', () => {
      expect(validateCNPJ('33.000.167/0001-99')).toBe(false);
    });

    it('deve rejeitar sequências repetidas de CNPJ', () => {
      expect(validateCNPJ('00000000000000')).toBe(false);
      expect(validateCNPJ('11.111.111/1111-11')).toBe(false);
    });
  });

  describe('validateCpfCnpj unificado', () => {
    it('deve identificar e formatar CPF válido', () => {
      const result = validateCpfCnpj('52998224725');
      expect(result.isValid).toBe(true);
      expect(result.type).toBe('CPF');
      expect(result.formatted).toBe('529.982.247-25');
    });

    it('deve identificar e formatar CNPJ válido', () => {
      const result = validateCpfCnpj('33000167000101');
      expect(result.isValid).toBe(true);
      expect(result.type).toBe('CNPJ');
      expect(result.formatted).toBe('33.000.167/0001-01');
    });

    it('deve reprovar dados desconhecidos ou inválidos', () => {
      const result = validateCpfCnpj('123');
      expect(result.isValid).toBe(false);
      expect(result.type).toBe('UNKNOWN');
    });
  });

  describe('Formatadores', () => {
    it('formatCPF formata com máscara correta', () => {
      expect(formatCPF('52998224725')).toBe('529.982.247-25');
    });

    it('formatCNPJ formata com máscara correta', () => {
      expect(formatCNPJ('33000167000101')).toBe('33.000.167/0001-01');
    });

    it('formatCpfCnpj detecta tamanho automaticamente', () => {
      expect(formatCpfCnpj('52998224725')).toBe('529.982.247-25');
      expect(formatCpfCnpj('33000167000101')).toBe('33.000.167/0001-01');
    });
  });
});
