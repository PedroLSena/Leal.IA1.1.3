/**
 * Leal.ai - Controller de Autenticação JWT
 * Login, renovação de tokens com rotação estrita, invalidação de sessão e auditoria.
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User } from '../models/User.js';
import { Organization } from '../models/Organization.js';
import { AuditLog } from '../models/AuditLog.js';
import { hashPassword, comparePassword } from '../utils/passwordGenerator.js';
import { sendEmail } from '../services/emailService.js';
import { generateSecurePassword } from '../utils/passwordGenerator.js';

const JWT_SECRET = process.env.JWT_SECRET || 'leal_ai_jwt_access_secret_super_secure_key_2026_change_in_production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'leal_ai_jwt_refresh_secret_ultra_secure_rotation_2026';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

/**
 * Gera hash SHA-256 do token para armazenamento seguro no banco
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Realiza login de usuário corporativo
 */
export async function login(req, res) {
  const { email, password } = req.body;
  const clientIp = req.ip || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'] || 'Desconhecido';

  try {
    const user = await User.findByEmail(email);

    if (!user) {
      await AuditLog.log({
        action: 'AUTH_LOGIN_FAILED',
        details: { email, reason: 'Usuário não encontrado' },
        ipAddress: clientIp,
        userAgent
      });
      return res.status(401).json({
        success: false,
        error: 'Credenciais inválidas. Verifique seu e-mail e senha.'
      });
    }

    if (user.status !== 'active') {
      await AuditLog.log({
        userId: user.id,
        action: 'AUTH_LOGIN_BLOCKED',
        details: { reason: 'Conta inativa' },
        ipAddress: clientIp,
        userAgent
      });
      return res.status(403).json({
        success: false,
        error: 'Esta conta está inativa. Solicite reativação ao gestor da organização.'
      });
    }

    const isMatch = await comparePassword(password, user.password_hash);
    if (!isMatch) {
      await AuditLog.log({
        userId: user.id,
        action: 'AUTH_LOGIN_FAILED',
        details: { email, reason: 'Senha incorreta' },
        ipAddress: clientIp,
        userAgent
      });
      return res.status(401).json({
        success: false,
        error: 'Credenciais inválidas. Verifique seu e-mail e senha.'
      });
    }

    // Gera access token de curta duração (15m)
    const accessToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        tier: user.tier,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Gera refresh token de longa duração (7d)
    const refreshToken = jwt.sign(
      {
        id: user.id,
        tokenId: crypto.randomUUID()
      },
      JWT_REFRESH_SECRET,
      { expiresIn: JWT_REFRESH_EXPIRES_IN }
    );

    // Salva hash do refresh token para possibilitar rotação e revogação
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await User.saveRefreshToken(user.id, hashToken(refreshToken), expiresAt);

    // Registra sucesso em audit_logs
    await AuditLog.log({
      userId: user.id,
      action: 'AUTH_LOGIN_SUCCESS',
      details: { email: user.email, tier: user.tier, role: user.role },
      ipAddress: clientIp,
      userAgent
    });

    // Sanitiza objeto de usuário para resposta (nunca retorna password_hash)
    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      organization: user.organization,
      category: user.category,
      role: user.role,
      roleName: user.roleName || user.role_name,
      tier: user.tier,
      sector: user.sector,
      oab: user.oab,
      reportsTo: user.reportsTo || user.reports_to,
      avatar: user.avatar,
      plan: user.plan,
      permissions: user.permissions || []
    };

    return res.status(200).json({
      success: true,
      message: 'Autenticação realizada com sucesso.',
      accessToken,
      refreshToken,
      user: safeUser
    });
  } catch (err) {
    console.error('[Auth Error]', err);
    return res.status(500).json({
      success: false,
      error: 'Erro no processo de autenticação.'
    });
  }
}

/**
 * Renovação de tokens com rotação estrita (Token Rotation)
 */
export async function refresh(req, res) {
  const { refreshToken } = req.body;
  const clientIp = req.ip || req.connection.remoteAddress;

  if (!refreshToken) {
    return res.status(400).json({ success: false, error: 'Refresh token é obrigatório.' });
  }

  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    const tokenHash = hashToken(refreshToken);

    const tokenRecord = await User.findRefreshToken(tokenHash);
    if (!tokenRecord) {
      return res.status(401).json({
        success: false,
        error: 'Refresh token revogado ou inválido. Faça login novamente.'
      });
    }

    const user = await User.findById(decoded.id);
    if (!user || user.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: 'Usuário não habilitado.'
      });
    }

    // Invalida o refresh token atual (Rotação)
    await User.revokeRefreshToken(tokenHash);

    // Emite novos tokens
    const newAccessToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        tier: user.tier,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    const newRefreshToken = jwt.sign(
      {
        id: user.id,
        tokenId: crypto.randomUUID()
      },
      JWT_REFRESH_SECRET,
      { expiresIn: JWT_REFRESH_EXPIRES_IN }
    );

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await User.saveRefreshToken(user.id, hashToken(newRefreshToken), expiresAt);

    await AuditLog.log({
      userId: user.id,
      action: 'AUTH_TOKEN_ROTATED',
      details: { email: user.email },
      ipAddress: clientIp
    });

    return res.status(200).json({
      success: true,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    });
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: 'Refresh token expirado ou inválido.'
    });
  }
}

/**
 * Encerra a sessão e revoga o refresh token
 */
export async function logout(req, res) {
  const { refreshToken } = req.body;
  const clientIp = req.ip || req.connection.remoteAddress;

  if (refreshToken) {
    try {
      const tokenHash = hashToken(refreshToken);
      await User.revokeRefreshToken(tokenHash);
    } catch (e) {
      // Ignore
    }
  }

  if (req.user) {
    await AuditLog.log({
      userId: req.user.id,
      action: 'AUTH_LOGOUT',
      details: { email: req.user.email },
      ipAddress: clientIp
    });
  }

  return res.status(200).json({
    success: true,
    message: 'Sessão encerrada com sucesso.'
  });
}

/**
 * Retorna os dados do perfil do usuário autenticado
 */
export async function getMe(req, res) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuário não encontrado.' });
    }

    delete user.password_hash;
    return res.status(200).json({
      success: true,
      user
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Erro ao obter perfil.' });
  }
}

/**
 * Auto-registro de novas organizações (self-onboarding).
 * Usuário titular vira administrador da própria organização.
 */
export async function register(req, res) {
  const {
    name,
    email,
    password,
    organization: orgName,
    cnpjCpf,
    category,
    sector,
    oab = 'Não informada'
  } = req.body;
  const clientIp = req.ip || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'] || 'Desconhecido';

  try {
    const existing = await User.findByEmail(email);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Já existe uma conta com este e-mail. Faça login ou recupere sua senha.'
      });
    }

    // Cria ou recupera a organização (pelo CNPJ)
    const org = await Organization.findOrCreate({
      name: orgName,
      cnpj: cnpjCpf,
      type: category,
      plan: 'Pro'
    });

    const passwordHash = await hashPassword(password);

    // Titular é o admin da organização (tier-1, gestão total)
    const user = await User.create({
      orgId: org.id,
      name,
      email,
      passwordHash,
      role: 'administrador',
      roleName: 'Administrador',
      tier: 'tier-1',
      sector,
      oab,
      reportsTo: 'Conselho',
      status: 'active',
      permissions: []
    });

    // Gera token de verificação de e-mail
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await User.saveEmailVerificationToken(user.id, hashToken(verificationToken), expiresAt);

    // Em MVP (sem e-mail real), retorna o token no corpo para permitir verificação; também notifica.
    await sendEmail({
      to: email,
      subject: 'Confirme seu e-mail no Leal.ai',
      text: `Olá ${name}! Confirme seu e-mail usando o token: ${verificationToken}`,
      html: `<p>Olá <strong>${name}</strong>!</p><p>Confirme seu e-mail no Leal.ai usando o token:</p><p><code>${verificationToken}</code></p>`
    });

    await AuditLog.log({
      userId: user.id,
      action: 'AUTH_REGISTER',
      details: { email: user.email, orgId: org.id, category },
      ipAddress: clientIp,
      userAgent
    });

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      organization: org.name,
      category: org.type,
      role: user.role,
      roleName: user.roleName || user.role_name,
      tier: user.tier,
      sector: user.sector,
      oab: user.oab,
      plan: org.plan
    };

    return res.status(201).json({
      success: true,
      message: 'Conta criada com sucesso. Verifique seu e-mail para ativar a conta.',
      verificationToken,
      user: safeUser
    });
  } catch (err) {
    console.error('[Register Error]', err);
    return res.status(500).json({
      success: false,
      error: 'Erro ao criar a conta. Tente novamente.'
    });
  }
}

/**
 * Verifica o e-mail do usuário com o token enviado
 */
export async function verifyEmail(req, res) {
  const { token } = req.body;
  const clientIp = req.ip || req.connection.remoteAddress;

  try {
    const tokenRecord = await User.findEmailVerificationToken(hashToken(token));
    if (!tokenRecord) {
      return res.status(400).json({
        success: false,
        error: 'Token de verificação inválido ou expirado.'
      });
    }

    await User.markEmailVerified(tokenRecord.user_id);
    await User.markEmailVerificationUsed(tokenRecord.id);

    await AuditLog.log({
      userId: tokenRecord.user_id,
      action: 'AUTH_EMAIL_VERIFIED',
      details: {},
      ipAddress: clientIp
    });

    return res.status(200).json({
      success: true,
      message: 'E-mail verificado com sucesso. Você já pode acessar sua conta.'
    });
  } catch (err) {
    console.error('[VerifyEmail Error]', err);
    return res.status(500).json({ success: false, error: 'Falha ao verificar e-mail.' });
  }
}

/**
 * Reenvia o token de verificação de e-mail
 */
export async function resendVerification(req, res) {
  const { email } = req.body;
  const clientIp = req.ip || req.connection.remoteAddress;

  try {
    const user = await User.findByEmail(email);
    if (!user) {
      // Resposta genérica para não revelar a existência do e-mail
      return res.status(200).json({
        success: true,
        message: 'Se o e-mail estiver cadastrado, enviaremos um novo link de verificação.'
      });
    }

    // Revoga tokens anteriores e cria um novo
    await User.revokeEmailVerificationTokens(user.id);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await User.saveEmailVerificationToken(user.id, hashToken(verificationToken), expiresAt);

    await sendEmail({
      to: email,
      subject: 'Reenvio de verificação - Leal.ai',
      text: `Olá ${user.name}! Use o token: ${verificationToken}`,
      html: `<p>Olá <strong>${user.name}</strong>!</p><p>Use o token para verificar seu e-mail: <code>${verificationToken}</code></p>`
    });

    await AuditLog.log({
      userId: user.id,
      action: 'AUTH_EMAIL_RESENT',
      details: {},
      ipAddress: clientIp
    });

    return res.status(200).json({
      success: true,
      message: 'Novo link de verificação enviado.',
      verificationToken
    });
  } catch (err) {
    console.error('[ResendVerification Error]', err);
    return res.status(500).json({ success: false, error: 'Falha ao reenviar verificação.' });
  }
}

/**
 * Solicita redefinição de senha (gera token + envia e-mail)
 */
export async function forgotPassword(req, res) {
  const { email } = req.body;
  const clientIp = req.ip || req.connection.remoteAddress;

  try {
    const user = await User.findByEmail(email);
    if (!user) {
      // Resposta genérica para não revelar a existência do e-mail
      return res.status(200).json({
        success: true,
        message: 'Se o e-mail estiver cadastrado, enviaremos as instruções de recuperação.'
      });
    }

    await User.revokePasswordResetTokens(user.id);
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await User.savePasswordResetToken(user.id, hashToken(resetToken), expiresAt);

    await sendEmail({
      to: email,
      subject: 'Redefinição de senha - Leal.ai',
      text: `Olá ${user.name}! Use o token para redefinir sua senha: ${resetToken}`,
      html: `<p>Olá <strong>${user.name}</strong>!</p><p>Use o token para redefinir sua senha: <code>${resetToken}</code></p>`
    });

    await AuditLog.log({
      userId: user.id,
      action: 'AUTH_PASSWORD_RESET_REQUESTED',
      details: {},
      ipAddress: clientIp
    });

    return res.status(200).json({
      success: true,
      message: 'Se o e-mail estiver cadastrado, enviaremos as instruções de recuperação.',
      resetToken
    });
  } catch (err) {
    console.error('[ForgotPassword Error]', err);
    return res.status(500).json({ success: false, error: 'Falha ao processar recuperação de senha.' });
  }
}

/**
 * Redefine a senha usando o token enviado
 */
export async function resetPassword(req, res) {
  const { token, password } = req.body;
  const clientIp = req.ip || req.connection.remoteAddress;

  try {
    const tokenRecord = await User.findPasswordResetToken(hashToken(token));
    if (!tokenRecord) {
      return res.status(400).json({
        success: false,
        error: 'Token de redefinição inválido ou expirado.'
      });
    }

    const user = await User.findById(tokenRecord.user_id);
    if (!user) {
      return res.status(400).json({ success: false, error: 'Usuário não encontrado.' });
    }

    const newHash = await hashPassword(password);
    await User.updatePassword(user.id, newHash);
    await User.markPasswordResetUsed(tokenRecord.id);

    // Invalida todas as sessões existentes após redefinição de senha
    await User.revokeAllUserRefreshTokens(user.id);

    await AuditLog.log({
      userId: user.id,
      action: 'AUTH_PASSWORD_RESET_COMPLETED',
      details: {},
      ipAddress: clientIp
    });

    return res.status(200).json({
      success: true,
      message: 'Senha redefinida com sucesso. Faça login com sua nova senha.'
    });
  } catch (err) {
    console.error('[ResetPassword Error]', err);
    return res.status(500).json({ success: false, error: 'Falha ao redefinir senha.' });
  }
}

/**
 * Troca de senha para usuário autenticado (exige senha atual)
 */
export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  const clientIp = req.ip || req.connection.remoteAddress;

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuário não encontrado.' });
    }

    const isMatch = await comparePassword(currentPassword, user.password_hash);
    if (!isMatch) {
      await AuditLog.log({
        userId: user.id,
        action: 'AUTH_PASSWORD_CHANGE_FAILED',
        details: { reason: 'Senha atual incorreta' },
        ipAddress: clientIp
      });
      return res.status(400).json({
        success: false,
        error: 'A senha atual está incorreta.'
      });
    }

    const newHash = await hashPassword(newPassword);
    await User.updatePassword(user.id, newHash);

    // Invalida demais sessões para segurança
    await User.revokeAllUserRefreshTokens(user.id);

    await AuditLog.log({
      userId: user.id,
      action: 'AUTH_PASSWORD_CHANGED',
      details: {},
      ipAddress: clientIp
    });

    return res.status(200).json({
      success: true,
      message: 'Senha alterada com sucesso.'
    });
  } catch (err) {
    console.error('[ChangePassword Error]', err);
    return res.status(500).json({ success: false, error: 'Falha ao alterar senha.' });
  }
}

export default {
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
};
