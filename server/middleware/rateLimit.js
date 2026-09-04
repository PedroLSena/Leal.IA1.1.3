/**
 * Leal.ai - Rate Limiting & Proteção contra Ataques de Força Bruta
 * Limita requisições por IP e bloqueia tentativas repetitivas de invasão.
 */

import rateLimit from 'express-rate-limit';

const isTest = process.env.NODE_ENV === 'test';

// Limitador geral de requisições da API (100 requisições por minuto)
export const generalLimiter = isTest
  ? (req, res, next) => next()
  : rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10), // 1 minuto
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        error: 'Muitas requisições originadas deste IP. Por favor, aguarde 1 minuto.'
      }
    });

// Limitador estrito para tentativas de login e autenticação (5 requisições por minuto em produção)
export const loginLimiter = isTest
  ? (req, res, next) => next()
  : rateLimit({
      windowMs: 60 * 1000, // 1 minuto
      max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX || '5', 10),
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        code: 'RATE_LIMIT_EXCEEDED',
        error: 'Muitas tentativas consecutivas de login. Acesso temporariamente bloqueado por 1 minuto para proteção da conta.'
      }
    });

export default {
  generalLimiter,
  loginLimiter
};
