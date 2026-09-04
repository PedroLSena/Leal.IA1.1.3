/**
 * Leal.ai - Modelo de Contratos Trabalhistas
 * Geração e gestão de minutas de contratos com isolamento multi-tenant (org_id).
 */

import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database.js';

export class Contract {
  /**
   * Cria um novo contrato
   */
  static async create({
    orgId,
    createdBy,
    title,
    contractType = 'clt',
    content,
    status = 'draft'
  }) {
    const id = uuidv4();
    const res = await query(
      `INSERT INTO contracts (id, org_id, created_by, title, contract_type, content, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id, orgId, createdBy, title, contractType, content, status]
    );
    return res.rows[0] || {
      id, org_id: orgId, created_by: createdBy, title, contract_type: contractType, content, status
    };
  }

  /**
   * Lista contratos do tenant (with creator name)
   */
  static async findAll({ orgId, limit = 100 }) {
    const res = await query(
      `SELECT c.*, u.name as created_by_name
       FROM contracts c
       LEFT JOIN users u ON c.created_by = u.id
       WHERE c.org_id = $1
       ORDER BY c.created_at DESC
       LIMIT $2`,
      [orgId, limit]
    );
    return res.rows;
  }

  /**
   * Busca contrato por id dentro da organização (isolamento)
   */
  static async findById(id, orgId) {
    const res = await query(
      `SELECT c.*, u.name as created_by_name
       FROM contracts c
       LEFT JOIN users u ON c.created_by = u.id
       WHERE c.id = $1 AND c.org_id = $2`,
      [id, orgId]
    );
    return res.rows[0] || null;
  }

  /**
   * Busca contrato por id sem restrição de org (super admin)
   */
  static async findByIdAny(id) {
    const res = await query(
      `SELECT c.*, u.name as created_by_name
       FROM contracts c
       LEFT JOIN users u ON c.created_by = u.id
       WHERE c.id = $1`,
      [id]
    );
    return res.rows[0] || null;
  }

  /**
   * Atualiza conteúdo/status de um contrato no tenant
   */
  static async update(id, orgId, { content, status, title }) {
    const res = await query(
      `UPDATE contracts
       SET content = COALESCE($1, content),
           status = COALESCE($2, status),
           title = COALESCE($3, title),
           signed_at = CASE WHEN $2 = 'signed' THEN CURRENT_TIMESTAMP ELSE signed_at END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 AND org_id = $5
       RETURNING *`,
      [content ?? null, status ?? null, title ?? null, id, orgId]
    );
    return res.rows[0] || null;
  }

  /**
   * Remove contrato no tenant
   */
  static async delete(id, orgId) {
    const res = await query(
      `DELETE FROM contracts WHERE id = $1 AND org_id = $2 RETURNING *`,
      [id, orgId]
    );
    return res.rows[0] || null;
  }
}

export default Contract;
