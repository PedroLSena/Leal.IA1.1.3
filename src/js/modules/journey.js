/**
 * Leal.ai - Módulo Monitor de Jornada e Ponto (UI)
 * Análise de registros + registro de ponto + lista de violações.
 */

import { journeyAPI } from '../services/api.js';
import { TokenService } from '../services/api.js';
import { sanitizeHTML, showToast } from '../utils/helpers.js';

const SEV_COLOR = { critico: '#dc2626', texto_critico: '#dc2626', alto: '#ea580c', medio: '#ca8a04' };

function sevColor(sev) {
  const s = String(sev || '').toLowerCase();
  if (s.includes('crit') || s === 'critico') return '#dc2626';
  if (s === 'alto' || s.includes('high')) return '#ea580c';
  return '#ca8a04';
}

export function initJourneyModule(AppState) {
  const state = { records: [], violations: [], stats: null };

  async function load() {
    try {
      const r = await journeyAPI.listRecords();
      state.records = r.records || [];
      state.violations = r.violations || [];
      state.stats = r.stats || null;
    } catch (e) {
      state.records = [];
      state.violations = [];
      state.stats = null;
    }
  }

  function analysisForm() {
    return `
      <div class="journey-analyze-card">
        <h3 class="contract-panel-title">Análise Rápida de Jornada</h3>
        <p class="contract-panel-sub">Informe pares de entrada/saída (formato ISO: 2024-01-01T08:00:00) para detectar violações sem persistir.</p>
        <div class="journey-rows" id="journey-rows">
          <div class="journey-row">
            <input type="text" class="form-control journey-clockin" placeholder="clockIn: 2024-01-01T08:00:00" />
            <input type="text" class="form-control journey-clockout" placeholder="clockOut: 2024-01-01T17:00:00" />
            <label class="journey-interval"><input type="checkbox" class="journey-intervalcb" /> intervalo</label>
          </div>
        </div>
        <div class="journey-actions">
          <button type="button" class="btn-secondary button-small" id="btn-journey-add">+ Adicionar dia</button>
          <button type="button" class="btn-primary" id="btn-journey-analyze">🔍 Analisar Jornada</button>
        </div>
        <div id="journey-analysis-result"></div>
      </div>
    `;
  }

  function registerForm() {
    return `
      <div class="journey-register-card">
        <h3 class="contract-panel-title">Registrar Ponto (colaborador logado)</h3>
        <p class="contract-panel-sub">Persiste um espelho de ponto vinculado ao seu usuário e retorna violações associadas.</p>
        <div class="journey-reg-row">
          <input type="text" class="form-control" id="jr-in" placeholder="clockIn: 2024-01-10T08:00:00" />
          <input type="text" class="form-control" id="jr-out" placeholder="clockOut: 2024-01-10T18:00:00" />
          <button type="button" class="btn-primary" id="btn-jr-save">Salvar Ponto</button>
        </div>
      </div>
    `;
  }

  function violationsHtml() {
    if (!state.violations.length) {
      return '<p class="risk-empty">Nenhuma violação detectada nos registros salvos.</p>';
    }
    return state.violations.map(v => `
      <div class="risk-finding" style="border-left:3px solid ${sevColor(v.severidade || v.severity)};">
        <span class="risk-sev-pill" style="background:${sevColor(v.severidade || v.severity)}22;color:${sevColor(v.severidade || v.severity)};">${sanitizeHTML(((v.severidade || v.severity) || 'medio').toUpperCase())}</span>
        <div>
          <strong>${sanitizeHTML(v.titulo || v.title || '')}</strong>
          <span class="risk-finding-cat">${sanitizeHTML(v.descricao || '')}</span>
        </div>
      </div>
    `).join('');
  }

  async function renderJourneyPanel() {
    const container = document.getElementById('journey-content');
    if (!container) return;
    await load();
    container.innerHTML = `
      <div class="journey-layout">
        <div>${analysisForm()} ${registerForm()}</div>
        <div class="journey-register-card">
          <h3 class="contract-panel-title">Registros Salvos</h3>
          ${state.stats ? `<p class="contract-panel-sub">Total: <strong>${state.stats.totalHours?.toFixed(1)}h</strong> · Extras: <strong>${state.stats.totalOvertime?.toFixed(1)}h</strong> · Média/dia: <strong>${state.stats.averagePerDay?.toFixed(1)}h</strong></p>` : ''}
          <div class="journey-saved-list">${renderSaved()}</div>
          <h4 class="risk-sec-title">Violações detectadas</h4>
          <div id="journey-violations-saved">${violationsHtml()}</div>
        </div>
      </div>
    `;

    document.getElementById('btn-journey-add')?.addEventListener('click', () => {
      const rows = document.getElementById('journey-rows');
      const row = document.createElement('div');
      row.className = 'journey-row';
      row.innerHTML = `
        <input type="text" class="form-control journey-clockin" placeholder="clockIn: 2024-01-02T08:00:00" />
        <input type="text" class="form-control journey-clockout" placeholder="clockOut: 2024-01-02T17:00:00" />
        <label class="journey-interval"><input type="checkbox" class="journey-intervalcb" /> intervalo</label>
      `;
      rows.appendChild(row);
    });

    document.getElementById('btn-journey-analyze')?.addEventListener('click', async () => {
      const rows = Array.from(document.querySelectorAll('.journey-row'));
      const records = rows.map(r => ({
        clockIn: r.querySelector('.journey-clockin').value || null,
        clockOut: r.querySelector('.journey-clockout').value || null,
        intervalTaken: r.querySelector('.journey-intervalcb').checked
      })).filter(r => r.clockIn || r.clockOut);
      if (!records.length) {
        showToast('Adicione ao menos um registro de jornada.', 'info');
        return;
      }
      try {
        const result = await journeyAPI.analyze(records);
        renderAnalysisResult(result);
      } catch (err) {
        showToast('Falha ao analisar a jornada.', 'error');
      }
    });

    document.getElementById('btn-jr-save')?.addEventListener('click', async () => {
      const user = TokenService.getCurrentUser();
      if (!user?.id) {
        showToast('Faça login para registrar o ponto.', 'info');
        return;
      }
      const clockIn = document.getElementById('jr-in').value;
      const clockOut = document.getElementById('jr-out').value;
      if (!clockIn || !clockOut) {
        showToast('Informe entrada e saída.', 'info');
        return;
      }
      try {
        await journeyAPI.createRecord({ userId: user.id, clockIn, clockOut });
        showToast('Ponto salvo com sucesso!', 'success');
        document.getElementById('jr-in').value = '';
        document.getElementById('jr-out').value = '';
        await load();
        document.getElementById('journey-violations-saved').innerHTML = violationsHtml();
        renderSaved();
      } catch (err) {
        showToast(err?.response?.data?.error || 'Falha ao salvar o ponto.', 'error');
      }
    });
  }

  function renderAnalysisResult(result) {
    const el = document.getElementById('journey-analysis-result');
    const violations = result?.violations || [];
    const stats = result?.stats || {};
    el.innerHTML = `
      <div class="journey-result-block">
        <p>Total: <strong>${stats.totalHours?.toFixed(1)}h</strong> · Extras: <strong>${stats.totalOvertime?.toFixed(1)}h</strong></p>
        ${violations.length ? `<h4 class="risk-sec-title">Violações (${violations.length})</h4>
          ${violations.map(v => `
            <div class="risk-finding" style="border-left:3px solid ${sevColor(v.severidade || v.severity)};">
              <strong>${sanitizeHTML(v.titulo || v.title || '')}</strong>
              <span class="risk-finding-cat">${sanitizeHTML(v.recomendacao || '')}</span>
            </div>`).join('')}`
          : '<p class="risk-empty">Nenhuma violação detectada.</p>'}
      </div>
    `;
  }

  function renderSaved() {
    const el = document.querySelector('.journey-saved-list');
    if (!el) return;
    if (!state.records.length) {
      el.innerHTML = '<p class="risk-empty">Nenhum registro salvo ainda.</p>';
      return;
    }
    el.innerHTML = state.records.slice(0, 20).map(r => `
      <div class="journey-saved-item">
        <span class="journey-date">${sanitizeHTML(String(r.date || '').slice(0, 10))}</span>
        <span class="journey-times">${r.hours_worked ?? '—'}h (extras ${r.overtime_hours ?? 0}h)</span>
      </div>
    `).join('');
  }

  async function refresh() {
    await renderJourneyPanel();
  }

  return { renderJourneyPanel, refresh };
}

export default initJourneyModule;
