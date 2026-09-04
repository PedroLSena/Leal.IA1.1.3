/**
 * Leal.ai - Módulo Dashboard Consolidado
 * Painel de KPIs que agrega os três módulos de IA (risco, contratos, jornada).
 * Consome as APIs já existentes — nenhum endpoint novo.
 */

import { riskAPI, contractsAPI, journeyAPI, billingAPI } from '../services/api.js';
import { sanitizeHTML, showToast } from '../utils/helpers.js';

const LEVEL_COLOR = { low: '#16a34a', medium: '#ca8a04', high: '#ea580c', critical: '#dc2626' };

export function initDashboardModule(AppState) {
  const state = {
    risks: [],
    contracts: [],
    journey: null,
    billing: null
  };

  async function loadAll() {
    try { state.risks = await riskAPI.list(); } catch (e) { state.risks = []; }
    try { state.contracts = await contractsAPI.list(); } catch (e) { state.contracts = []; }
    try { state.journey = await journeyAPI.listRecords(); } catch (e) { state.journey = null; }
    try {
      const b = await billingAPI.subscription();
      state.billing = b.subscription;
    } catch (e) { state.billing = null; }
  }

  function avgScore(risks) {
    if (!risks.length) return 0;
    return Math.round(risks.reduce((a, r) => a + (r.risk_score || 0), 0) / risks.length);
  }

  function worstLevel(risks) {
    if (!risks.length) return null;
    const order = { low: 0, medium: 1, high: 2, critical: 3 };
    return risks.reduce((w, r) =>
      (order[r.risk_level] ?? 0) > (order[w?.risk_level] ?? -1) ? r : w, null);
  }

  function journeyViolations(j) {
    if (!j || !Array.isArray(j.violations)) return 0;
    return j.violations.length;
  }

  function journeyHours(j) {
    return j?.stats?.totalHours || 0;
  }

  function billingBadge(sub) {
    if (!sub) return '';
    return `<span class="dash-billing-plan">Plano: <strong>${sanitizeHTML((sub.plan_id || 'pro').toUpperCase())}</strong>
      <span class="dash-billing-status status-${sub.status}">${sub.status}</span></span>`;
  }

  async function renderDashboard() {
    const container = document.getElementById('dashboard-content');
    if (!container) return;
    container.innerHTML = '<p class="risk-empty" style="padding:40px;text-align:center;">Carregando dashboard...</p>';
    await loadAll();

    const w = worstLevel(state.risks);
    const wColor = w ? (LEVEL_COLOR[w.risk_level] || '#16a34a') : '#16a34a';
    const signedContracts = state.contracts.filter(c => c.status === 'signed').length;

    container.innerHTML = `
      <div class="dash-billing-row">${billingBadge(state.billing)}</div>
      <div class="dash-kpi-grid">
        <div class="dash-kpi">
          <span class="dash-kpi-label">Risco médio</span>
          <strong style="color:${wColor};">${avgScore(state.risks)}<small>/100</small></strong>
          <span class="dash-kpi-sub">${w ? sanitizeHTML((w.risk_level || '').toUpperCase()) : 'Sem auditorias'}</span>
        </div>
        <div class="dash-kpi">
          <span class="dash-kpi-label">Auditorias</span>
          <strong>${state.risks.length}</strong>
          <span class="dash-kpi-sub">análises salvas</span>
        </div>
        <div class="dash-kpi">
          <span class="dash-kpi-label">Contratos</span>
          <strong>${state.contracts.length}</strong>
          <span class="dash-kpi-sub">${signedContracts} assinados</span>
        </div>
        <div class="dash-kpi">
          <span class="dash-kpi-label">Registros de ponto</span>
          <strong>${state.journey?.records?.length || 0}</strong>
          <span class="dash-kpi-sub">${journeyHours(state.journey).toFixed(1)}h totais</span>
        </div>
        <div class="dash-kpi dash-kpi-warn">
          <span class="dash-kpi-label">Violações de jornada</span>
          <strong>${journeyViolations(state.journey)}</strong>
          <span class="dash-kpi-sub">${journeyViolations(state.journey) ? 'atendimento necessário' : 'nenhuma detectada'}</span>
        </div>
      </div>

      <div class="dash-panels">
        <div class="dash-panel">
          <h3 class="dash-panel-title">🔎 Últimas Auditorias de Risco</h3>
          ${state.risks.length ? state.risks.slice(0, 5).map(r => {
            const c = LEVEL_COLOR[r.risk_level] || '#16a34a';
            return `<div class="dash-row">
              <span class="dash-dot" style="background:${c}"></span>
              <span class="dash-row-title">${sanitizeHTML(r.title || 'Auditoria')}</span>
              <span class="dash-row-meta">${r.risk_score} · ${r.status}</span>
            </div>`;
          }).join('') : '<p class="risk-empty">Nenhuma auditoria ainda. Use o Auditor de Riscos.</p>'}
        </div>

        <div class="dash-panel">
          <h3 class="dash-panel-title">📄 Últimos Contratos</h3>
          ${state.contracts.length ? state.contracts.slice(0, 5).map(c => `
            <div class="dash-row">
              <span class="dash-dot" style="background:${c.status === 'signed' ? '#16a34a' : '#ca8a04'}"></span>
              <span class="dash-row-title">${sanitizeHTML(c.title || 'Contrato')}</span>
              <span class="dash-row-meta">${c.status}</span>
            </div>`).join('') : '<p class="risk-empty">Nenhum contrato gerado ainda.</p>'}
        </div>
      </div>
    `;
  }

  async function refresh() {
    await renderDashboard();
  }

  return { renderDashboard, refresh };
}

export default initDashboardModule;
