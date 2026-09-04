/**
 * Leal.ai - Controller de Gestão de Contas Hierárquicas
 * CRUD completo, integração com RBAC, hashing de senhas, validação CPF/CNPJ e logs de auditoria.
 */

import { v4 as uuidv4 } from 'uuid';
import { User } from '../models/User.js';
import { Organization } from '../models/Organization.js';
import { AuditLog } from '../models/AuditLog.js';
import { formatCpfCnpj, cleanDigits } from '../utils/cpfCnpjValidator.js';
import { hashPassword, generateSecurePassword } from '../utils/passwordGenerator.js';
import { TIER_PERMISSIONS } from '../models/Permission.js';

/**
 * Lista todas as contas do sistema com suporte a busca e filtros
 */
export async function listAccounts(req, res) {
  try {
    const { search, category, tier } = req.query;
    // Isolamento multi-tenant: admin vê tudo; demais veem apenas a própria organização
    const accounts = await User.findAll({
      search, category, tier,
      orgId: req.orgScope || undefined
    });

    return res.status(200).json({
      success: true,
      count: accounts.length,
      data: accounts
    });
  } catch (err) {
    console.error('[AccountController.listAccounts]', err);
    return res.status(500).json({ success: false, error: 'Falha ao buscar contas cadastradas.' });
  }
}

/**
 * Retorna os detalhes de uma conta específica
 */
export async function getAccountById(req, res) {
  try {
    // req.targetUser já foi carregado e validado (mesmo tenant) pelo middleware
    const account = req.targetUser;
    delete account.password_hash;
    return res.status(200).json({
      success: true,
      data: account
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Falha ao buscar detalhes da conta.' });
  }
}

/**
 * Cria uma nova conta hierárquica no sistema
 */
export async function createAccount(req, res) {
  const clientIp = req.ip || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'] || 'Desconhecido';

  try {
    const {
      name,
      email,
      password,
      organization,
      cnpjCpf,
      category,
      role,
      roleName,
      tier,
      sector,
      oab,
      reportsTo,
      plan,
      permissions
    } = req.body;

    // Verifica unicidade do e-mail
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: `O e-mail ${email} já está registrado na plataforma Leal.ai.`
      });
    }

    // Formatação canônica do documento
    const formattedCnpjCpf = formatCpfCnpj(cnpjCpf);

    // Encontra ou cria a organização correspondente
    // - Super Admin (leal_admin): usa a organização informada (pode criar/associar qualquer uma)
    // - Usuário comum: vinculado exclusivamente à sua própria organização (tenant).
    //   Ignora organization/cnpjCpf fornecidos pelo cliente para evitar a
    //   alocação indevida de contas em outros tenants.
    const isAdmin = req.user.category === 'leal_admin' || req.tenantAccess === 'all';

    let org;
    if (isAdmin) {
      org = await Organization.findOrCreate({
        name: organization,
        cnpj: formattedCnpjCpf,
        type: category,
        plan: plan || 'Pro'
      });
    } else {
      org = await Organization.findById(req.user.orgId);
      if (!org) {
        return res.status(403).json({
          success: false,
          error: 'Sua organização não foi encontrada. Contate o suporte.'
        });
      }
    }

    // Gera senha provisória segura caso não seja fornecida
    const rawPassword = password || generateSecurePassword(16);
    const passwordHash = await hashPassword(rawPassword);

    // Determina permissões (customizadas ou padrão do Tier)
    const effectivePermissions = (permissions && permissions.length > 0)
      ? permissions
      : (TIER_PERMISSIONS[tier] || []);

    const newUserId = uuidv4();

    const createdUser = await User.create({
      id: newUserId,
      orgId: org.id,
      name,
      email: email.toLowerCase(),
      passwordHash,
      role,
      roleName: roleName || role,
      tier,
      sector,
      oab: oab || 'Não informada',
      reportsTo: reportsTo || 'Conselho / Diretoria Geral',
      status: 'active',
      permissions: effectivePermissions
    });

    // Registra evento de auditoria
    await AuditLog.log({
      userId: req.user ? req.user.id : newUserId,
      action: 'ACCOUNT_CREATED',
      details: {
        createdUserId: newUserId,
        name,
        email,
        organization,
        tier,
        role
      },
      ipAddress: clientIp,
      userAgent
    });

    const responseUser = {
      id: createdUser.id,
      name: createdUser.name,
      email: createdUser.email,
      organization: org.name,
      category: org.type,
      cnpjCpf: formattedCnpjCpf,
      role: createdUser.role,
      roleName: createdUser.roleName || createdUser.role_name,
      tier: createdUser.tier,
      sector: createdUser.sector,
      oab: createdUser.oab,
      reportsTo: createdUser.reportsTo || createdUser.reports_to,
      status: createdUser.status,
      avatar: createdUser.avatar,
      plan: org.plan,
      permissions: effectivePermissions,
      createdAt: createdUser.created_at || new Date().toISOString()
    };

    return res.status(201).json({
      success: true,
      message: `Conta criada com sucesso para ${name}!`,
      data: responseUser,
      // Se a senha foi gerada automaticamente, informa uma única vez para repasse seguro
      ...(!password && { temporaryPassword: rawPassword })
    });
  } catch (err) {
    console.error('[AccountController.createAccount]', err);
    return res.status(500).json({ success: false, error: 'Falha ao criar conta no banco de dados.' });
  }
}

/**
 * Alterna ou atualiza o status de uma conta (active / disabled)
 */
export async function updateAccountStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;
  const clientIp = req.ip || req.connection.remoteAddress;

  try {
    // req.targetUser já carregado e validado como do mesmo tenant pelo middleware
    const user = req.targetUser;
    if (!user) {
      return res.status(404).json({ success: false, error: 'Conta não encontrada.' });
    }

    const updated = await User.updateStatus(id, status);

    await AuditLog.log({
      userId: req.user.id,
      action: 'ACCOUNT_STATUS_UPDATED',
      details: { targetUserId: id, oldStatus: user.status, newStatus: status },
      ipAddress: clientIp
    });

    return res.status(200).json({
      success: true,
      message: `Status da conta atualizado para "${status}".`,
      data: updated
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Falha ao alterar status da conta.' });
  }
}

/**
 * Exclui uma conta do sistema
 */
export async function deleteAccount(req, res) {
  const { id } = req.params;
  const clientIp = req.ip || req.connection.remoteAddress;

  try {
    // req.targetUser já carregado e validado como do mesmo tenant pelo middleware
    const user = req.targetUser;
    if (!user) {
      return res.status(404).json({ success: false, error: 'Conta não encontrada.' });
    }

    await User.delete(id);

    await AuditLog.log({
      userId: req.user.id,
      action: 'ACCOUNT_DELETED',
      details: { deletedUserId: id, name: user.name, email: user.email },
      ipAddress: clientIp
    });

    return res.status(200).json({
      success: true,
      message: `Conta de ${user.name} excluída com sucesso.`
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Falha ao remover conta.' });
  }
}

/**
 * Estatísticas rápidas de contas, organizações e advogados
 */
export async function getStats(req, res) {
  try {
    // Isolamento multi-tenant: stats apenas do tenant do usuário autenticado (admin vê tudo)
    const accounts = await User.findAll({ orgId: req.orgScope || undefined });
    const orgs = new Set(accounts.map(a => a.organization).filter(Boolean));
    const lawyers = accounts.filter(a =>
      a.category === 'escritorio' ||
      a.category === 'advogado' ||
      (a.oab && a.oab.includes('OAB') && !a.oab.includes('Não'))
    );

    return res.status(200).json({
      success: true,
      stats: {
        totalAccounts: accounts.length,
        totalOrganizations: orgs.size,
        totalLawyers: lawyers.length
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Falha ao calcular estatísticas.' });
  }
}

export default {
  listAccounts,
  getAccountById,
  createAccount,
  updateAccountStatus,
  deleteAccount,
  getStats
};
