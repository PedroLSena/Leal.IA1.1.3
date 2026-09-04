/**
 * Leal.ai - Modelo de Análise de Risco Trabalhista
 * Registra análises multi-tenant (org_id) com isolamento por organização.
 */

import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database.js';

export class RiskScore {
  /**
   * Cria uma nova análise de risco
   */
  static async create({
    orgId,
    createdBy,
    title,
    description,
    findings = [],
    riskLevel,
    riskScore,
    recommendations = [],
    summary,
    status = 'draft'
  }) {
    const id = uuidv4();
    const res = await query(
      `INSERT INTO risk_scores
         (id, org_id, created_by, title, description, findings, risk_level, risk_score, recommendations, summary, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [id, orgId, createdBy, title, description, JSON.stringify(findings), riskLevel, riskScore, JSON.stringify(recommendations), summary, status]
    );
    return res.rows[0] || {
      id, org_id: orgId, created_by: createdBy, title, description, findings,
      risk_level: riskLevel, risk_score: riskScore, recommendations, summary, status
    };
  }

  /**
   * Lista análises, escopadas por organização
   */
  static async findAll({ orgId, limit = 100 }) {
    const res = await query(
      `SELECT r.*, u.name as created_by_name
       FROM risk_scores r
       LEFT JOIN users u ON r.created_by = u.id
       WHERE r.org_id = $1
       ORDER BY r.created_at DESC
       LIMIT $2`,
      [orgId, limit]
    );
    return res.rows;
  }

  /**
   * Busca uma análise por ID dentro de uma organização (isolamento de tenant)
   */
  static async findById(id, orgId) {
    const res = await query(
      `SELECT r.*, u.name as created_by_name
       FROM risk_scores r
       LEFT JOIN users u ON r.created_by = u.id
       WHERE r.id = $1 AND r.org_id = $2`,
      [id, orgId]
    );
    return res.rows[0] || null;
  }

  /**
   * Busca uma análise por ID sem restrição de organização (super admin global)
   */
  static async findByIdAny(id) {
    const res = await query(
      `SELECT r.*, u.name as created_by_name
       FROM risk_scores r
       LEFT JOIN users u ON r.created_by = u.id
       WHERE r.id = $1`,
      [id]
    );
    return res.rows[0] || null;
  }

  /**
   * Atualiza o status de uma análise (reviewed/resolved) - escopado por org
   */
  static async updateStatus(id, orgId, status) {
    const res = await query(
      `UPDATE risk_scores
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND org_id = $3
       RETURNING *`,
      [status, id, orgId]
    );
    return res.rows[0] || null;
  }

  /**
   * Remove uma análise - escopado por org
   */
  static async delete(id, orgId) {
    const res = await query(
      `DELETE FROM risk_scores WHERE id = $1 AND org_id = $2 RETURNING id`,
      [id, orgId]
    );
    return res.rows[0] || null;
  }
}

export default RiskScore;
