/**
 * Leal.ai - Trilha de Auditoria (Audit Logs)
 * Registra todas as ações sensíveis no sistema em conformidade com a LGPD e governança corporativa.
 */

import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database.js';

export class AuditLog {
  /**
   * Registra um novo evento de auditoria
   * @param {Object} param
   * @param {string} [param.userId]
   * @param {string} param.action
   * @param {Object} [param.details]
   * @param {string} [param.ipAddress]
   * @param {string} [param.userAgent]
   * @returns {Promise<Object>}
   */
  static async log({ userId = null, action, details = {}, ipAddress = null, userAgent = null }) {
    const id = uuidv4();
    try {
      const res = await query(
        `INSERT INTO audit_logs (id, user_id, action, details, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [id, userId, action, JSON.stringify(details), ipAddress, userAgent]
      );
      return res.rows[0];
    } catch (err) {
      console.error('[AuditLog Error] Falha ao registrar log de auditoria:', err.message);
      return null;
    }
  }

  /**
   * Retorna os últimos logs de auditoria
   * @param {number} [limit=100]
   * @returns {Promise<Array<Object>>}
   */
  static async getRecent(limit = 100) {
    const res = await query(
      `SELECT a.*, u.name as user_name, u.email as user_email
       FROM audit_logs a
       LEFT JOIN users u ON a.user_id = u.id
       ORDER BY a.created_at DESC
       LIMIT $1`,
      [limit]
    );
    return res.rows;
  }
}

export default AuditLog;
