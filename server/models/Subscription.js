/**
 * Leal.ai - Modelo de Assinatura (Billing por Organização)
 * Vincula uma organização a um plano com estado de ciclo de vida billing.
 */

import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database.js';

const PLANS = {
  starter: { id: 'starter', name: 'Starter', priceMonthlyBRL: 99, maxUsers: 5, description: 'Para advogados solo e pequenos negócios' },
  pro: { id: 'pro', name: 'Pro', priceMonthlyBRL: 299, maxUsers: 25, description: 'Para startups e médias empresas' },
  enterprise: { id: 'enterprise', name: 'Enterprise', priceMonthlyBRL: 999, maxUsers: 999, description: 'Para bancas jurídicas e grandes operações' }
};

export class Subscription {
  static listPlans() {
    return Object.values(PLANS);
  }

  static getPlan(planId) {
    return PLANS[planId] || PLANS.pro;
  }

  static async findByOrg(orgId) {
    const res = await query(
      `SELECT s.*, p.name as plan_name, p.price_monthly_brl, p.max_users, p.description
       FROM subscriptions s
       LEFT JOIN plans p ON s.plan_id = p.id
       WHERE s.org_id = $1`,
      [orgId]
    );
    return res.rows[0] || null;
  }

  /**
   * Garante uma assinatura para a org (trial por padrão), criando se necessário.
   */
  static async getOrCreateForOrg(orgId, { planId = 'pro' } = {}) {
    const existing = await this.findByOrg(orgId);
    if (existing) return existing;

    const id = uuidv4();
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString();
    const periodEnd = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
    const res = await query(
      `INSERT INTO subscriptions (id, org_id, plan_id, status, trial_ends_at, current_period_end)
       VALUES ($1, $2, $3, 'trial', $4, $5)
       RETURNING *`,
      [id, orgId, planId, trialEndsAt, periodEnd]
    );
    return res.rows[0] || {
      id, org_id: orgId, plan_id: planId, status: 'trial',
      trial_ends_at: trialEndsAt, current_period_end: periodEnd
    };
  }

  /**
   * Atualiza plano/status/assentos da assinatura da org.
   */
  static async update(orgId, { planId, status, seatCount, cancelAtPeriodEnd }) {
    const res = await query(
      `UPDATE subscriptions
       SET plan_id = COALESCE($1, plan_id),
           status = COALESCE($2, status),
           seat_count = COALESCE($3, seat_count),
           cancel_at_period_end = COALESCE($4, cancel_at_period_end),
           updated_at = CURRENT_TIMESTAMP
       WHERE org_id = $5
       RETURNING *`,
      [planId ?? null, status ?? null, seatCount ?? null, cancelAtPeriodEnd ?? null, orgId]
    );
    return res.rows[0] || null;
  }

  static async findByIdAny(id) {
    const res = await query(
      `SELECT s.*, p.name as plan_name FROM subscriptions s
       LEFT JOIN plans p ON s.plan_id = p.id
       WHERE s.id = $1`,
      [id]
    );
    return res.rows[0] || null;
  }
}

export default Subscription;
