/**
 * Leal.ai - Rotas de Autenticação
 */

import { Router } from 'express';
import {
  login,
  refresh,
  logout,
  getMe,
  register,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  changePassword
} from '../controllers/authController.js';
import { authenticateJWT } from '../middleware/auth.js';
import {
  validate,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema
} from '../middleware/validation.js';
import { loginLimiter } from '../middleware/rateLimit.js';

const router = Router();

// Login com rate limit estrito (5 tentativas por minuto)
router.post('/login', loginLimiter, validate(loginSchema), login);

// Renovação de token de acesso com rotação de refresh token
router.post('/refresh', validate(refreshTokenSchema), refresh);

// Logout e revogação de tokens
router.post('/logout', logout);

// Perfil do usuário autenticado
router.get('/me', authenticateJWT, getMe);

// Auto-registro de novas organizações (self-onboarding)
router.post('/register', validate(registerSchema), register);

// Verificação de e-mail
router.post('/verify-email', validate(verifyEmailSchema), verifyEmail);

// Reenvio de verificação de e-mail
router.post('/resend-verification', validate(resendVerificationSchema), resendVerification);

// Recuperação de senha
router.post('/forgot-password', validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);

// Troca de senha (autenticado)
router.post('/change-password', authenticateJWT, validate(changePasswordSchema), changePassword);

export default router;
