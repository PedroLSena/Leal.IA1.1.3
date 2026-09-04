/**
 * Leal.ai - Rotas de Billing e Assinaturas
 * Assinatura por organização, planos e faturas.
 * RBAC: exige permissão `billing_view` (tier-1 / leal_admin) + isolamento de tenant.
 */

import { Router } from 'express';
import { Subscription } from '../models/Subscription.js';
import { Invoice, generatePaymentDetails } from '../models/Invoice.js';
import { AuditLog } from '../models/AuditLog.js';
import { authenticateJWT, requirePermission } from '../middleware/auth.js';
import { scopeTenant } from '../middleware/tenantIsolation.js';
import { validate, updateSubscriptionSchema, generateInvoiceSchema, payInvoiceSchema } from '../middleware/validation.js';

const router = Router();

router.use(authenticateJWT);
router.use(scopeTenant);
router.use(requirePermission('billing_view'));

/**
 * GET /api/billing/plans
 * Catálogo de planos disponíveis.
 */
router.get('/plans', async (req, res) => {
  try {
    return res.status(200).json({ success: true, data: Subscription.listPlans() });
  } catch (err) {
    console.error('[BillingPlans Error]', err);
    return res.status(500).json({ success: false, error: 'Falha ao listar planos.' });
  }
});

/**
 * GET /api/billing/subscription
 * Assinatura da organização atual (ou do tenant alvo se super admin).
 */
router.get('/subscription', async (req, res) => {
  try {
    const orgId = req.orgScope ? req.orgScope : req.user.orgId;
    const sub = await Subscription.getOrCreateForOrg(orgId);
    const invoices = await Invoice.listByOrg(orgId);
    return res.status(200).json({ success: true, data: { subscription: sub, invoices } });
  } catch (err) {
    console.error('[BillingSubscription Error]', err);
    return res.status(500).json({ success: false, error: 'Falha ao obter assinatura.' });
  }
});

/**
 * POST /api/billing/subscription/checkout
 * Gera/renova a fatura do período da assinatura (sandbox).
 * Se já houver fatura em aberto, retorna a existente (idempotente).
 */
router.post('/subscription/checkout', async (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  try {
    const orgId = req.orgScope ? req.orgScope : req.user.orgId;
    const method = req.body.paymentMethod || 'pix';

    let sub = await Subscription.getOrCreateForOrg(orgId);
    const plan = Subscription.getPlan(sub.plan_id);

    // Idempotência: reaproveita fatura em aberto existente
    let invoice = await Invoice.findOpenByOrg(orgId);
    if (invoice) {
      return res.status(200).json({ success: true, data: { invoice, isNew: false, plan } });
    }

    const dueDate = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();
    const periodEnd = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
    const details = generatePaymentDetails(method);

    invoice = await Invoice.create({
      orgId,
      subscriptionId: sub.id,
      amountBRL: plan.priceMonthlyBRL,
      status: 'open',
      paymentMethod: method,
      dueDate,
      periodStart: new Date().toISOString(),
      periodEnd,
      paymentDetails: { ...details, seatCount: sub.seat_count || 1 }
    });

    await AuditLog.log({
      userId: req.user.id,
      action: 'INVOICE_GENERATED',
      details: { invoiceId: invoice.id, amount: plan.priceMonthlyBRL, method },
      ipAddress: clientIp
    });

    return res.status(201).json({ success: true, data: { invoice, isNew: true, plan } });
  } catch (err) {
    console.error('[BillingCheckout Error]', err);
    return res.status(500).json({ success: false, error: 'Falha ao gerar fatura.' });
  }
});

/**
 * POST /api/billing/invoices/:id/pay
 * Confirma o pagamento de uma fatura (modo sandbox).
 */
router.post('/invoices/:id/pay', validate(payInvoiceSchema), async (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  try {
    const orgId = req.orgScope ? req.orgScope : req.user.orgId;
    const invoice = await Invoice.findById(req.params.id, orgId);
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Fatura não encontrada.' });
    }
    if (invoice.status === 'paid') {
      return res.status(200).json({ success: true, data: invoice, message: 'Fatura já estava paga.' });
    }
    if (invoice.status === 'void') {
      return res.status(409).json({ success: false, error: 'Fatura cancelada não pode ser paga.' });
    }

    const transactionId = `tx_${Math.random().toString(36).slice(2, 14)}`;
    const paid = await Invoice.markPaid(req.params.id, orgId, { transactionId });

    await AuditLog.log({
      userId: req.user.id,
      action: 'INVOICE_PAID',
      details: { invoiceId: invoice.id, amount: invoice.amount_brl, transactionId },
      ipAddress: clientIp
    });

    return res.status(200).json({ success: true, data: paid, message: 'Pagamento confirmado.' });
  } catch (err) {
    console.error('[BillingPay Error]', err);
    return res.status(500).json({ success: false, error: 'Falha ao confirmar pagamento.' });
  }
});

/**
 * GET /api/billing/invoices/:id
 * Detalhe de uma fatura do tenant.
 */
router.get('/invoices/:id', async (req, res) => {
  try {
    const orgId = req.orgScope ? req.orgScope : req.user.orgId;
    const invoice = await Invoice.findById(req.params.id, orgId);
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Fatura não encontrada.' });
    }
    return res.status(200).json({ success: true, data: invoice });
  } catch (err) {
    console.error('[BillingInvoiceDetail Error]', err);
    return res.status(500).json({ success: false, error: 'Falha ao obter fatura.' });
  }
});

/**
 * PATCH /api/billing/subscription
 * Atualiza plano/status/assentos da assinatura da organização.
 */
router.patch('/subscription', validate(updateSubscriptionSchema), async (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  try {
    const orgId = req.orgScope ? req.orgScope : req.user.orgId;

    // Gera fatura quando o plano muda (pro-rata simplificado = plano novo)
    let changedPlan = false;
    if (req.body.planId) {
      const current = await Subscription.findByOrg(orgId);
      if (!current || current.plan_id !== req.body.planId) changedPlan = true;
    }

    const updated = await Subscription.update(orgId, req.body);
    if (!updated) {
      // Garante existência e tenta novamente
      await Subscription.getOrCreateForOrg(orgId);
      const retry = await Subscription.update(orgId, req.body);
      if (!retry) {
        return res.status(404).json({ success: false, error: 'Assinatura não encontrada.' });
      }

      if (changedPlan) await generateInvoiceFor(subscriptionForRetry(orgId, req.body.planId));
      await AuditLog.log({
        userId: req.user.id,
        action: 'BILLING_UPDATED',
        details: { changes: req.body },
        ipAddress: clientIp
      });
      return res.status(200).json({ success: true, data: retry });
    }

    if (changedPlan) await generateInvoiceFor(updated);

    await AuditLog.log({
      userId: req.user.id,
      action: 'BILLING_UPDATED',
      details: { changes: req.body },
      ipAddress: clientIp
    });

    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    console.error('[BillingUpdate Error]', err);
    return res.status(500).json({ success: false, error: 'Falha ao atualizar assinatura.' });
  }
});

async function subscriptionForRetry(orgId, planId) {
  return { org_id: orgId, plan_id: planId, id: null };
}

async function generateInvoiceFor(sub) {
  if (!sub || !sub.org_id) return;
  const plan = Subscription.getPlan(sub.plan_id);
  const orgId = sub.org_id;
  const existing = await Invoice.findOpenByOrg(orgId);
  if (existing) return;
  const details = generatePaymentDetails('pix');
  await Invoice.create({
    orgId,
    subscriptionId: sub.id,
    amountBRL: plan.priceMonthlyBRL,
    status: 'open',
    paymentMethod: 'pix',
    dueDate: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
    periodStart: new Date().toISOString(),
    periodEnd: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    paymentDetails: { ...details, seatCount: sub.seat_count || 1 }
  });
}

export default router;
