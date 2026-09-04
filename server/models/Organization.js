/**
 * Leal.ai - Modelo de Organização (Empresas, Escritórios, Parceiros)
 */

import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database.js';

export class Organization {
  /**
   * Busca organização por ID
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  static async findById(id) {
    const res = await query('SELECT * FROM organizations WHERE id = $1', [id]);
    return res.rows[0] || null;
  }

  /**
   * Busca organização por CNPJ
   * @param {string} cnpj
   * @returns {Promise<Object|null>}
   */
  static async findByCnpj(cnpj) {
    const res = await query('SELECT * FROM organizations WHERE cnpj = $1', [cnpj]);
    return res.rows[0] || null;
  }

  /**
   * Lista todas as organizações
   * @returns {Promise<Array<Object>>}
   */
  static async findAll() {
    const res = await query('SELECT * FROM organizations ORDER BY name ASC');
    return res.rows;
  }

  /**
   * Cria uma nova organização
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  static async create({ name, cnpj, type = 'empresa', plan = 'Pro' }) {
    const id = uuidv4();
    const res = await query(
      `INSERT INTO organizations (id, name, cnpj, type, plan)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, name, cnpj, type, plan]
    );
    return res.rows[0] || { id, name, cnpj, type, plan };
  }

  /**
   * Encontra ou cria uma organização com base no nome e CNPJ
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  static async findOrCreate({ name, cnpj, type, plan }) {
    if (cnpj) {
      const existing = await this.findByCnpj(cnpj);
      if (existing) return existing;
    }
    return this.create({ name, cnpj, type, plan });
  }
}

export default Organization;
