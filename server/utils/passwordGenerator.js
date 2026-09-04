/**
 * Leal.ai - Gerenciador Seguro de Senhas
 * Geração criptograficamente segura (16+ caracteres), hashing com bcrypt (cost factor 12)
 * e validação de políticas rigorosas de senha para ambientes corporativos e jurídicos.
 */

import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const BCRYPT_SALT_ROUNDS = 12;

const CHARSETS = {
  uppercase: 'ABCDEFGHJKLMNPQRSTUVWXYZ', // Remove confusões visuais como I, O
  lowercase: 'abcdefghijkmnopqrstuvwxyz', // Remove l
  numbers: '23456789',                   // Remove 0, 1
  symbols: '!@#$%^&*()-_=+[]{}|;:,.<>?'
};

/**
 * Gera uma senha aleatória de alta entropia
 * @param {number} [length=18] Mínimo recomendado 16 caracteres
 * @returns {string}
 */
export function generateSecurePassword(length = 18) {
  const targetLength = Math.max(length, 16);
  const allChars = CHARSETS.uppercase + CHARSETS.lowercase + CHARSETS.numbers + CHARSETS.symbols;

  // Garante ao menos 1 de cada grupo
  const guaranteed = [
    CHARSETS.uppercase[crypto.randomInt(0, CHARSETS.uppercase.length)],
    CHARSETS.lowercase[crypto.randomInt(0, CHARSETS.lowercase.length)],
    CHARSETS.numbers[crypto.randomInt(0, CHARSETS.numbers.length)],
    CHARSETS.symbols[crypto.randomInt(0, CHARSETS.symbols.length)]
  ];

  const remainingLength = targetLength - guaranteed.length;
  const remaining = [];

  for (let i = 0; i < remainingLength; i++) {
    const randomIdx = crypto.randomInt(0, allChars.length);
    remaining.push(allChars[randomIdx]);
  }

  // Embaralha o array (Fisher-Yates shuffle com crypto)
  const combined = guaranteed.concat(remaining);
  for (let i = combined.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }

  return combined.join('');
}

/**
 * Hash seguro de senha usando bcrypt com cost factor 12
 * @param {string} plainPassword
 * @returns {Promise<string>}
 */
export async function hashPassword(plainPassword) {
  if (!plainPassword || typeof plainPassword !== 'string') {
    throw new Error('A senha deve ser uma string não vazia');
  }
  const salt = await bcrypt.genSalt(BCRYPT_SALT_ROUNDS);
  return bcrypt.hash(plainPassword, salt);
}

/**
 * Compara senha em texto plano com o hash armazenado
 * @param {string} plainPassword
 * @param {string} hashedPassword
 * @returns {Promise<boolean>}
 */
export async function comparePassword(plainPassword, hashedPassword) {
  if (!plainPassword || !hashedPassword) return false;
  return bcrypt.compare(plainPassword, hashedPassword);
}

/**
 * Valida a política de senha forte
 * - Mínimo de 8 caracteres (12+ recomendado)
 * - Ao menos 1 letra maiúscula
 * - Ao menos 1 letra minúscula
 * - Ao menos 1 número
 * - Ao menos 1 símbolo especial
 * @param {string} password
 * @returns {{ isValid: boolean, errors: string[] }}
 */
export function validatePasswordStrength(password) {
  const errors = [];
  if (!password || password.length < 8) {
    errors.push('A senha deve conter no mínimo 8 caracteres.');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('A senha deve conter ao menos uma letra maiúscula.');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('A senha deve conter ao menos uma letra minúscula.');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('A senha deve conter ao menos um número.');
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('A senha deve conter ao menos um caractere especial (!@#$%...).');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export default {
  generateSecurePassword,
  hashPassword,
  comparePassword,
  validatePasswordStrength
};
