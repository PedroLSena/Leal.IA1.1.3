/**
 * Leal.ai - Modelo de Registros de Jornada e Ponto
 * Registros multi-tenant (org_id) de ponto e jornada dos colaboradores.
 */

import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database.js';

export class JourneyRecord {
  /**
   * Cria/registra um espelho de ponto
   */
  static async create({
    orgId,
    userId,
    date,
    clockIn,
    clockOut,
    hoursWorked,
    overtimeHours,
    notes
  }) {
    const id = uuidv4();
    const res = await query(
      `INSERT INTO journey_records (id, org_id, user_id, date, clock_in, clock_out, hours_worked, overtime_hours, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [id, orgId, userId, date, clockIn, clockOut, hoursWorked, overtimeHours, notes]
    );
    return res.rows[0] || {
      id, org_id: orgId, user_id: userId, date, clock_in: clockIn,
      clock_out: clockOut, hours_worked: hoursWorked, overtime_hours: overtimeHours, notes
    };
  }

  /**
   * Lista registros de um colaborador dentro do tenant
   */
  static async findByUserInOrg(userId, orgId, limit = 100) {
    const res = await query(
      `SELECT r.*, u.name as user_name
       FROM journey_records r
       LEFT JOIN users u ON r.user_id = u.id
       WHERE r.user_id = $1 AND r.org_id = $2
       ORDER BY r.date DESC
       LIMIT $3`,
      [userId, orgId, limit]
    );
    return res.rows;
  }

  /**
   * Lista todos os registros de um tenant
   */
  static async findAllInOrg(orgId, limit = 200) {
    const res = await query(
      `SELECT r.*, u.name as user_name
       FROM journey_records r
       LEFT JOIN users u ON r.user_id = u.id
       WHERE r.org_id = $1
       ORDER BY r.date DESC, r.created_at DESC
       LIMIT $2`,
      [orgId, limit]
    );
    return res.rows;
  }

  /**
   * Busca registro por id dentro do tenant
   */
  static async findById(id, orgId) {
    const res = await query(
      `SELECT r.*, u.name as user_name
       FROM journey_records r
       LEFT JOIN users u ON r.user_id = u.id
       WHERE r.id = $1 AND r.org_id = $2`,
      [id, orgId]
    );
    return res.rows[0] || null;
  }

  /**
   * Remove registro dentro do tenant
   */
  static async delete(id, orgId) {
    const res = await query(
      `DELETE FROM journey_records WHERE id = $1 AND org_id = $2 RETURNING *`,
      [id, orgId]
    );
    return res.rows[0] || null;
  }
}

export default JourneyRecord;
