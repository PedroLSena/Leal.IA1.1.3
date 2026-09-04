/**
 * Leal.ai - Modelo de Usuário e Gestão de Contas Hierárquicas
 * Implementa queries SQL com prepared statements, associação com organizações e RBAC.
 */

import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database.js';
import { Permission, TIER_PERMISSIONS } from './Permission.js';

export class User {
  /**
   * Busca usuário por ID (com dados da organização)
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  static async findById(id, orgId = null) {
    const params = [id];
    let orgClause = '';
    if (orgId) {
      orgClause = ' AND u.org_id = $2';
      params.push(orgId);
    }
    const res = await query(
      `SELECT u.*, o.name as organization, o.type as category, o.plan, o.cnpj as "cnpjCpf"
       FROM users u
       LEFT JOIN organizations o ON u.org_id = o.id
       WHERE u.id = $1${orgClause}`,
      params
    );

    if (res.rows.length === 0) return null;
    const user = res.rows[0];
    user.permissions = await this.getUserPermissions(user.id, user.tier);
    return user;
  }

  /**
   * Busca usuário por e-mail (para login)
   * @param {string} email
   * @returns {Promise<Object|null>}
   */
  static async findByEmail(email) {
    const res = await query(
      `SELECT u.*, o.name as organization, o.type as category, o.plan, o.cnpj as "cnpjCpf"
       FROM users u
       LEFT JOIN organizations o ON u.org_id = o.id
       WHERE LOWER(u.email) = LOWER($1)`,
      [email]
    );

    if (res.rows.length === 0) return null;
    const user = res.rows[0];
    user.permissions = await this.getUserPermissions(user.id, user.tier);
    return user;
  }

  /**
   * Lista todos os usuários com filtros opcionais
   * @param {Object} [filters={}]
   * @returns {Promise<Array<Object>>}
   */
  static async findAll(filters = {}) {
    const { orgId } = filters;
    let orgClause = '';
    const params = [];
    if (orgId) {
      orgClause = ' WHERE u.org_id = $1';
      params.push(orgId);
    }

    const res = await query(
      `SELECT u.id, u.org_id, u.name, u.email, u.role, u.role_name as "roleName", 
              u.tier, u.sector, u.oab, u.reports_to as "reportsTo", u.avatar, u.status, 
              u.created_at as "createdAt",
              o.name as organization, o.type as category, o.plan, o.cnpj as "cnpjCpf"
       FROM users u
       LEFT JOIN organizations o ON u.org_id = o.id
       ${orgClause}
       ORDER BY u.created_at DESC`,
      params
    );

    let users = res.rows;

    // Carrega permissões para cada usuário
    for (const u of users) {
      u.permissions = await this.getUserPermissions(u.id, u.tier);
    }

    if (filters.category && filters.category !== 'all') {
      users = users.filter(u => u.category === filters.category);
    }

    if (filters.tier && filters.tier !== 'all') {
      users = users.filter(u => u.tier === filters.tier);
    }

    if (filters.search) {
      const q = filters.search.toLowerCase();
      users = users.filter(u =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.organization && u.organization.toLowerCase().includes(q)) ||
        (u.sector && u.sector.toLowerCase().includes(q)) ||
        (u.roleName && u.roleName.toLowerCase().includes(q))
      );
    }

    return users;
  }

  /**
   * Cria um novo usuário
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  static async create({
    id = uuidv4(),
    orgId,
    name,
    email,
    passwordHash,
    role,
    roleName,
    tier,
    sector,
    oab = 'Não informada',
    reportsTo = 'Conselho',
    avatar,
    status = 'active',
    permissions = []
  }) {
    const initials = avatar || name.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

    const res = await query(
      `INSERT INTO users (id, org_id, name, email, password_hash, role, role_name, tier, sector, oab, reports_to, avatar, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [id, orgId, name, email.toLowerCase(), passwordHash, role, roleName, tier, sector, oab, reportsTo, initials, status]
    );

    const user = res.rows[0] || { id, orgId, name, email, role, roleName, tier, sector, oab, reportsTo, avatar: initials, status };

    // Salva permissões customizadas se fornecidas
    if (permissions && permissions.length > 0) {
      await this.setUserPermissions(user.id, permissions);
      user.permissions = permissions;
    } else {
      user.permissions = TIER_PERMISSIONS[tier] || [];
    }

    return user;
  }

  /**
   * Atualiza status do usuário (active / disabled)
   * @param {string} id
   * @param {'active'|'disabled'} status
   * @returns {Promise<Object>}
   */
  static async updateStatus(id, status) {
    const res = await query(
      `UPDATE users
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );
    return res.rows[0];
  }

  /**
   * Exclui um usuário
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  static async delete(id) {
    const res = await query('DELETE FROM users WHERE id = $1', [id]);
    return res.rowCount > 0;
  }

  /**
   * Retorna as permissões ativas de um usuário (combina default do Tier com overrides)
   * @param {string} userId
   * @param {string} tier
   * @returns {Promise<Array<string>>}
   */
  static async getUserPermissions(userId, tier) {
    const defaultPerms = TIER_PERMISSIONS[tier] || [];

    try {
      const res = await query(
        'SELECT permission_id FROM user_permissions WHERE user_id = $1',
        [userId]
      );
      if (res.rows.length > 0) {
        return res.rows.map(r => r.permission_id);
      }
    } catch (e) {
      // Caso a tabela ainda não tenha permissões específicas
    }

    return defaultPerms;
  }

  /**
   * Define permissões customizadas para o usuário
   * @param {string} userId
   * @param {Array<string>} permissionIds
   */
  static async setUserPermissions(userId, permissionIds) {
    await query('DELETE FROM user_permissions WHERE user_id = $1', [userId]);

    for (const permId of permissionIds) {
      await query(
        `INSERT INTO user_permissions (user_id, permission_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, permission_id) DO NOTHING`,
        [userId, permId]
      );
    }
  }

  /**
   * Salva um refresh token com hash
   * @param {string} userId
   * @param {string} tokenHash
   * @param {Date} expiresAt
   */
  static async saveRefreshToken(userId, tokenHash, expiresAt) {
    const id = uuidv4();
    await query(
      `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [id, userId, tokenHash, expiresAt]
    );
  }

  /**
   * Busca refresh token válido
   * @param {string} tokenHash
   */
  static async findRefreshToken(tokenHash) {
    const res = await query(
      `SELECT * FROM refresh_tokens
       WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP`,
      [tokenHash]
    );
    return res.rows[0] || null;
  }

  /**
   * Invalida um refresh token (para rotação e logout)
   * @param {string} tokenHash
   */
  static async revokeRefreshToken(tokenHash) {
    await query(
      `UPDATE refresh_tokens
       SET revoked_at = CURRENT_TIMESTAMP
       WHERE token_hash = $1`,
      [tokenHash]
    );
  }

  /**
   * Invalida todos os refresh tokens de um usuário (logout em todos dispositivos)
   * @param {string} userId
   */
  static async revokeAllUserRefreshTokens(userId) {
    await query(
      `UPDATE refresh_tokens
       SET revoked_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId]
    );
  }

  /**
   * Marca o e-mail do usuário como verificado
   * @param {string} userId
   */
  static async markEmailVerified(userId) {
    const res = await query(
      `UPDATE users
       SET email_verified = TRUE, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [userId]
    );
    return res.rows[0];
  }

  /**
   * Atualiza a senha do usuário (hash)
   * @param {string} userId
   * @param {string} newPasswordHash
   */
  static async updatePassword(userId, newPasswordHash) {
    const res = await query(
      `UPDATE users
       SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [newPasswordHash, userId]
    );
    return res.rows[0];
  }

  /**
   * Salva um token de verificação de e-mail (hash)
   */
  static async saveEmailVerificationToken(userId, tokenHash, expiresAt) {
    const id = uuidv4();
    await query(
      `INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [id, userId, tokenHash, expiresAt]
    );
  }

  /**
   * Busca token de verificação de e-mail válido
   */
  static async findEmailVerificationToken(tokenHash) {
    const res = await query(
      `SELECT * FROM email_verification_tokens
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP`,
      [tokenHash]
    );
    return res.rows[0] || null;
  }

  /**
   * Marca token de verificação como usado
   */
  static async markEmailVerificationUsed(tokenId) {
    await query(
      `UPDATE email_verification_tokens
       SET used_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [tokenId]
    );
  }

  /**
   * Revoga todos os tokens de verificação de e-mail de um usuário
   */
  static async revokeEmailVerificationTokens(userId) {
    await query(
      `UPDATE email_verification_tokens
       SET used_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND used_at IS NULL`,
      [userId]
    );
  }

  /**
   * Salva um token de reset de senha (hash)
   */
  static async savePasswordResetToken(userId, tokenHash, expiresAt) {
    const id = uuidv4();
    await query(
      `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [id, userId, tokenHash, expiresAt]
    );
  }

  /**
   * Busca token de reset de senha válido
   */
  static async findPasswordResetToken(tokenHash) {
    const res = await query(
      `SELECT * FROM password_reset_tokens
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP`,
      [tokenHash]
    );
    return res.rows[0] || null;
  }

  /**
   * Marca token de reset como usado
   */
  static async markPasswordResetUsed(tokenId) {
    await query(
      `UPDATE password_reset_tokens
       SET used_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [tokenId]
    );
  }

  /**
   * Revoga todos os tokens de reset de um usuário
   */
  static async revokePasswordResetTokens(userId) {
    await query(
      `UPDATE password_reset_tokens
       SET used_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND used_at IS NULL`,
      [userId]
    );
  }
}

export default User;
