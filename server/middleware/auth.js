/**
 * Leal.ai - Middleware de Autenticação JWT e Controle de Acesso RBAC
 * Valida tokens de curta duração (15 min) e verifica permissões e tiers hierárquicos.
 */

import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || 'leal_ai_jwt_access_secret_super_secure_key_2026_change_in_production';

/**
 * Middleware para validar o token JWT no cabeçalho Authorization: Bearer <token>
 */
export async function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Token de acesso não fornecido ou formato inválido (use Bearer <token>).'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Carrega dados atualizados do usuário para garantir que não foi desativado
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Usuário vinculado ao token não foi encontrado.'
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: 'Esta conta de usuário foi desativada. Contate o administrador.'
      });
    }

    // Anexa dados de sessão na requisição
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      roleName: user.roleName || user.role_name,
      tier: user.tier,
      sector: user.sector,
      organization: user.organization,
      orgId: user.org_id,
      category: user.category,
      permissions: user.permissions || []
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        code: 'TOKEN_EXPIRED',
        error: 'Sua sessão expirou. Renove o token com o refresh token.'
      });
    }

    return res.status(401).json({
      success: false,
      error: 'Token inválido ou assinatura corrompida.'
    });
  }
}

/**
 * Middleware para exigir permissão RBAC específica
 * @param {string} requiredPermission
 */
export function requirePermission(requiredPermission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Autenticação necessária.' });
    }

    // Super Admin (tier-1 da plataforma ou permissão direta)
    const hasPermission = req.user.permissions.includes(requiredPermission) || req.user.tier === 'tier-1';

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: `Acesso negado. Seu perfil (${req.user.tier}) não possui a permissão requerida: ${requiredPermission}.`
      });
    }

    next();
  };
}

/**
 * Middleware para restringir acesso por nível de Tier (ex: apenas tier-1 e tier-2)
 * @param {Array<string>} allowedTiers
 */
export function requireTier(allowedTiers) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Autenticação necessária.' });
    }

    if (!allowedTiers.includes(req.user.tier)) {
      return res.status(403).json({
        success: false,
        error: `Acesso negado. Ação restrita aos níveis de hierarquia: ${allowedTiers.join(', ')}.`
      });
    }

    next();
  };
}

/**
 * Middleware para exigir UMA das permissões RBAC listadas (OR)
 * @param {Array<string>} requiredPermissions
 */
export function requireAnyPermission(requiredPermissions) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Autenticação necessária.' });
    }

    if (req.user.tier === 'tier-1') return next();

    const hasAny = (req.user.permissions || []).some(p => requiredPermissions.includes(p));
    if (!hasAny) {
      return res.status(403).json({
        success: false,
        error: `Acesso negado. Seu perfil (${req.user.tier}) não possui nenhuma das permissões requeridas: ${requiredPermissions.join(', ')}.`
      });
    }

    next();
  };
}

export default {
  authenticateJWT,
  requirePermission,
  requireAnyPermission,
  requireTier
};
