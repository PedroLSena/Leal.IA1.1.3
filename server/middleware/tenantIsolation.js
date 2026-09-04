/**
 * Leal.ai - Middleware de Isolamento Multi-Tenant
 * Garante que um usuário autenticado só acesse dados da sua própria organização,
 * salvo Super Administradores da plataforma (categoria leal_admin).
 *
 * Isolamento aplicado a operações de leitura/escrita sobre contas e hierarquia.
 */

/**
 * Define o escopo de organização no req para filtros nas queries.
 * - Super admin (leal_admin / tier-1 global): vê tudo (req.orgScope = null)
 * - Demais usuários: restrito à sua própria organização (req.orgScope = orgId)
 */
export function scopeTenant(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Autenticação necessária.' });
  }

  // Super Admin da plataforma (categoria leal_admin) acessa todos os tenants
  if (req.user.category === 'leal_admin') {
    req.tenantAccess = 'all';
    req.orgScope = null;
    return next();
  }

  if (!req.user.orgId) {
    return res.status(403).json({
      success: false,
      error: 'Sua conta não está vinculada a nenhuma organização. Contate o suporte.'
    });
  }

  req.tenantAccess = 'own';
  req.orgScope = req.user.orgId;
  next();
}

/**
 * Exige que o recurso-alvo (conta/usuário) pertença à organização do solicitante.
 * Deve ser invocado após um organizador ter carregado o alvo (ex: req.targetUser).
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
export function ensureSameTenant(req, res, next) {
  if (req.tenantAccess === 'all') return next();

  if (!req.targetUser) {
    return res.status(404).json({ success: false, error: 'Recurso não encontrado.' });
  }

  if (req.targetUser.org_id !== req.user.orgId) {
    return res.status(403).json({
      success: false,
      error: 'Acesso negado. Este recurso pertence a outra organização.'
    });
  }

  next();
}

/**
 * Middleware auxiliar que carrega o usuário-alvo (por id) no req.targetUser
 * para permitir a checagem de isolamento de tenant.
 */
export async function loadTargetUser(req, res, next) {
  const { User } = await import('../models/User.js');
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ success: false, error: 'Identificador do usuário é obrigatório.' });
  }

  try {
    const target = await User.findById(id);
    if (!target) {
      return res.status(404).json({ success: false, error: 'Conta não encontrada.' });
    }
    req.targetUser = target;
    next();
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Erro ao carregar o recurso.' });
  }
}

export default {
  scopeTenant,
  ensureSameTenant,
  loadTargetUser
};
