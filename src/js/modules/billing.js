/**
 * Leal.ai - Módulo de Billing e Assinaturas (UI)
 * Exibe plano atual e permite trocar de plano (tier-1 / billing_view).
 */

import { billingAPI } from '../services/api.js';
import { sanitizeHTML, showToast } from '../utils/helpers.js';

export function initBillingModule(AppState) {
  const state = { subscription: null, invoices: [], plans: [] };

  async function load() {
    try {
      const [sub, plans] = await Promise.all([
        billingAPI.subscription(),
        billingAPI.plans()
      ]);
      state.subscription = sub.subscription;
      state.invoices = sub.invoices || [];
      state.plans = plans;
    } catch (e) {
      state.subscription = null;
      state.invoices = [];
      state.plans = [];
    }
  }

  function formatBRL(v) {
    const n = Number(v);
    if (isNaN(n)) return 'R$ 0,00';
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  async function renderBillingPanel() {
    const container = document.getElementById('billing-content');
    if (!container) return;
    container.innerHTML = '<p class="risk-empty" style="padding:40px;text-align:center;">Carregando billing...</p>';
    await load();

    const sub = state.subscription;
    container.innerHTML = `
      <div class="billing-hero">
        <div>
          <h2 class="contract-panel-title">Plano Atual</h2>
          <p class="contract-panel-sub">Plano <strong>${sanitizeHTML((sub?.plan_id || 'pro').toUpperCase())}</strong> · status <span class="dash-billing-status status-${sub?.status || ''}">${sub?.status || '—'}</span></p>
          <p class="contract-panel-sub">Assentos: <strong>${sub?.seat_count ?? 1}</strong> ${sub?.cancel_at_period_end ? '· cancelamento agendado' : ''}</p>
        </div>
      </div>

      <div class="billing-plans" id="billing-plans"></div>

      <div class="journey-register-card" style="margin-top:20px;">
        <h3 class="contract-panel-title">Faturas Recentes</h3>
        ${state.invoices.length ? state.invoices.slice(0, 10).map(i => `
          <div class="journey-saved-item">
            <span class="journey-date">${sanitizeHTML(String(i.created_at || '').slice(0, 10))}</span>
            <span class="journey-times">${formatBRL(i.amount_brl)} · <span class="dash-billing-status status-${i.status}">${i.status}</span></span>
          </div>`).join('') : '<p class="risk-empty">Nenhuma fatura gerada ainda.</p>'}
      </div>
    `;

    renderPlans();
  }

  function renderPlans() {
    const el = document.getElementById('billing-plans');
    if (!el) return;
    if (!state.plans.length) {
      el.innerHTML = '<p class="risk-empty">Catálogo indisponível.</p>';
      return;
    }
    const current = state.subscription?.plan_id;
    el.innerHTML = state.plans.map(p => `
      <div class="billing-plan ${current === p.id ? 'current' : ''}">
        <h4>${sanitizeHTML(p.name)}</h4>
        <div class="billing-price">${formatBRL(p.priceMonthlyBRL)}<span>/mês</span></div>
        <p class="contract-panel-sub">${sanitizeHTML(p.description || '')}</p>
        <p class="contract-panel-sub">Até <strong>${p.maxUsers}</strong> usuários</p>
        <button class="btn-primary button-small ${current === p.id ? 'btn-disabled' : ''}"
          data-plan="${p.id}" ${current === p.id ? 'disabled' : ''}>
          ${current === p.id ? 'Plano atual' : 'Selecionar'}
        </button>
      </div>
    `).join('');

    el.querySelectorAll('.billing-plan button[data-plan]').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await billingAPI.updateSubscription({ planId: btn.dataset.plan, status: 'active' });
          showToast(`Plano alterado para ${btn.dataset.plan}.`, 'success');
          await load();
          renderBillingPanel();
        } catch (err) {
          showToast('Falha ao alterar o plano.', 'error');
        }
      });
    });
  }

  async function refresh() {
    await renderBillingPanel();
  }

  return { renderBillingPanel, refresh };
}

export default initBillingModule;
