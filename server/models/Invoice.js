/**
 * Leal.ai - Modelo de Faturas (Billing)
 * Faturas por organização, vinculadas à assinatura.
 */

import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database.js';

export const PAYMENT_METHODS = ['pix', 'boleto', 'card', 'manual'];
const VALID_KEYS = ['pix', 'boleto', 'card'];

/**
 * Gera um código PIX sandbox (EMV estático simplificado) e linha digitável de boleto.
 */
export function generatePaymentDetails(method) {
  let pixCode = null;
  let boleto = null;
  if (method === 'pix') {
    // Copia-e-cola PIX sandbox
    const txid = Math.random().toString(36).slice(2, 14).toUpperCase();
    pixCode = `00020126580014BR.GOV.BCB.PIX0136${txid}5204000053039865802BR5913LEALAI6009SAO PAULO62070503***6304ABCD`;
  } else if (method === 'boleto') {
    const num = Array.from({ length: 47 }, () => Math.floor(Math.random() * 10)).join('');
    boleto = num;
  }
  return { pixCode, boleto };
}

export class Invoice {
  static async create({
    orgId, subscriptionId, amountBRL, periodStart, periodEnd,
    status = 'open', paymentMethod, dueDate, paymentDetails
  }) {
    const id = uuidv4();
    const res = await query(
      `INSERT INTO invoices (id, org_id, subscription_id, amount_brl, status, period_start, period_end,
         payment_method, due_date, payment_details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [id, orgId, subscriptionId, amountBRL, status, periodStart, periodEnd,
        paymentMethod || null, dueDate || null, paymentDetails || null]
    );
    return res.rows[0] || {
      id, org_id: orgId, subscription_id: subscriptionId,
      amount_brl: amountBRL, status, period_start: periodStart, period_end: periodEnd,
      payment_method: paymentMethod || null, due_date: dueDate || null,
      payment_details: paymentDetails || null
    };
  }

  static async listByOrg(orgId, limit = 50) {
    const res = await query(
      `SELECT * FROM invoices WHERE org_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [orgId, limit]
    );
    return res.rows;
  }

  static async findById(id, orgId) {
    const res = await query(
      `SELECT * FROM invoices WHERE id = $1 AND org_id = $2`,
      [id, orgId]
    );
    return res.rows[0] || null;
  }

  static async findByIdAny(id) {
    const res = await query('SELECT * FROM invoices WHERE id = $1', [id]);
    return res.rows[0] || null;
  }

  /**
   * Marca uma fatura como paga.
   */
  static async markPaid(id, orgId, { transactionId } = {}) {
    const res = await query(
      `UPDATE invoices
       SET status = 'paid', paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP),
           transaction_id = COALESCE($3, transaction_id), updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND org_id = $2
       RETURNING *`,
      [id, orgId, transactionId ?? null]
    );
    return res.rows[0] || null;
  }

  /**
   * Marca uma fatura como vencida (overdue).
   */
  static async markOverdue(orgId, { days = 3 } = {}) {
    const res = await query(
      `UPDATE invoices
       SET status = 'overdue'
       WHERE org_id = $1 AND status = 'open'
         AND due_date < CURRENT_TIMESTAMP - ($2 || ' days')::interval
       RETURNING *`,
      [orgId, days]
    );
    return res.rows;
  }

  /**
   * Encontra a fatura em aberto mais recente de uma organização.
   */
  static async findOpenByOrg(orgId) {
    const res = await query(
      `SELECT * FROM invoices
       WHERE org_id = $1 AND status = 'open'
       ORDER BY created_at DESC LIMIT 1`,
      [orgId]
    );
    return res.rows[0] || null;
  }

  static validateMethod(method) {
    return VALID_KEYS.includes(method);
  }
}

export default Invoice;
