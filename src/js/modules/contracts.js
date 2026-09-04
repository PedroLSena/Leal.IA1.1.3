/**
 * Leal.ai - Módulo de Gestão de Contratos Trabalhistas (UI)
 * Geração de minutas CLT + listagem, visualização, status e exclusão.
 */

import { contractsAPI } from '../services/api.js';
import { sanitizeHTML, showToast } from '../utils/helpers.js';

const CONTRACT_FIELDS = [
  ['nomeTrabalhador', 'Nome do Trabalhador *', 'text', 'Ex: João da Silva'],
  ['cargo', 'Cargo / Função *', 'text', 'Ex: Analista Jurídico'],
  ['empresa', 'Empresa / Contratante *', 'text', 'Ex: Leal SaaS Ltda'],
  ['cnpj', 'CNPJ', 'text', '00.000.000/0001-00'],
  ['cpf', 'CPF', 'text', '000.000.000-00'],
  ['salarioBase', 'Salário Base (R$)', 'number', 'Ex: 3500'],
  ['cidade', 'Cidade', 'text', 'Ex: São Paulo'],
  ['jornadaSemanal', 'Jornada Semanal', 'text', 'Ex: 44 horas semanais'],
  ['dataAdmissao', 'Data de Admissão', 'date', ''],
  ['sindicato', 'Sindicato / Convenção Coletiva', 'text', 'Ex: Sindicato da categoria'],
  ['regime', 'Regime de Contratação', 'select', 'clt', [['clt', 'CLT'], ['pj', 'PJ']]],
  ['jornada', 'Modalidade de Jornada', 'select', 'padrao', [['padrao', 'Padrão'], ['misto', 'Turnos / Misto'], ['noturno', 'Noturno']]]
];

export function initContractsModule(AppState) {
  const state = { list: [], detail: null };

  async function load() {
    try { state.list = await contractsAPI.list(); } catch (e) { state.list = []; }
  }

  function formHtml() {
    const rows = CONTRACT_FIELDS.map(f => {
      const [key, label, type, placeholder, options] = f;
      let input;
      if (type === 'select') {
        const opts = options.map(([v, l]) =>
          `<option value="${v}" ${placeholder === v ? 'selected' : ''}>${l}</option>`).join('');
        input = `<select id="cf-${key}" class="form-control">${opts}</select>`;
      } else {
        input = `<input type="${type}" id="cf-${key}" class="form-control" placeholder="${placeholder}" ${label.includes('*') ? 'required' : ''} />`;
      }
      return `<div class="form-group"><label for="cf-${key}" style="font-size:12.5px;font-weight:600;display:block;margin-bottom:5px;">${label}</label>${input}</div>`;
    }).join('');

    return `
      <div class="contracts-layout">
        <div class="contract-form-card">
          <h3 class="contract-panel-title">Gerar Minuta de Contrato (CLT)</h3>
          <p class="contract-panel-sub">Preencha os dados do vínculo. O motor gera a minuta com cláusulas protetivas e alertas de risco.</p>
          <form id="contract-form" novalidate>
            <div class="form-grid">${rows}</div>
            <div class="risk-form-foot">
              <button type="submit" class="btn-primary" id="btn-contract-generate">⚡ Gerar Contrato</button>
            </div>
          </form>
        </div>
        <div class="contract-list-card">
          <h3 class="contract-panel-title">Contratos Gerados</h3>
          <div id="contract-list"></div>
        </div>
      </div>
      <div class="contract-detail-card" id="contract-detail-card" style="display:none;"></div>
    `;
  }

  function renderList() {
    const listEl = document.getElementById('contract-list');
    if (!listEl) return;
    if (!state.list.length) {
      listEl.innerHTML = '<p class="risk-empty">Nenhum contrato gerado ainda.</p>';
      return;
    }
    listEl.innerHTML = state.list.map(c => `
      <div class="contract-item" data-id="${c.id}">
        <div class="contract-item-meta">
          <strong>${sanitizeHTML(c.title || 'Contrato')}</strong>
          <span class="contract-status status-${c.status}">${c.status}</span>
        </div>
        <div class="contract-item-actions">
          <button class="btn-secondary button-small" data-action="view" title="Ver minuta">👁</button>
          <button class="btn-secondary button-small" data-action="status" title="Marcar assinado">✍</button>
          <button class="btn-delete-risk" data-action="del" title="Excluir">🗑</button>
        </div>
      </div>
    `).join('');

    listEl.querySelectorAll('.contract-item').forEach(item => {
      item.querySelector('[data-action="view"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        viewDetail(item.dataset.id);
      });
      item.querySelector('[data-action="status"]')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        const c = state.list.find(x => x.id === item.dataset.id);
        const next = c?.status === 'signed' ? 'draft' : 'signed';
        try {
          await contractsAPI.update(item.dataset.id, { status: next });
          showToast(`Status atualizado para ${next}.`, 'success');
          await load();
          renderList();
          refreshDetail();
        } catch (err) {
          showToast('Falha ao atualizar status.', 'error');
        }
      });
      item.querySelector('[data-action="del"]')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm('Excluir este contrato?')) return;
        try {
          await contractsAPI.remove(item.dataset.id);
          showToast('Contrato excluído.', 'success');
          await load();
          renderList();
        } catch (err) {
          showToast('Falha ao excluir contrato.', 'error');
        }
      });
    });
  }

  async function viewDetail(id) {
    try {
      const c = await contractsAPI.getById(id);
      if (!c) return;
      const card = document.getElementById('contract-detail-card');
      card.style.display = 'block';
      card.innerHTML = `
        <div class="contract-detail-head">
          <h3>${sanitizeHTML(c.title || 'Contrato')}</h3>
          <span class="contract-status status-${c.status}">${c.status}</span>
        </div>
        <pre class="contract-pre">${sanitizeHTML(c.content || '')}</pre>
      `;
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (err) {
      showToast('Falha ao carregar o contrato.', 'error');
    }
  }

  function refreshDetail() {}

  async function renderContractsPanel() {
    const container = document.getElementById('contracts-content');
    if (!container) return;
    await load();
    container.innerHTML = formHtml();
    renderList();

    document.getElementById('contract-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {};
      CONTRACT_FIELDS.forEach(([key, , type]) => {
        const el = document.getElementById(`cf-${key}`);
        if (el) payload[key] = type === 'number' ? Number(el.value) : el.value;
      });
      const btn = document.getElementById('btn-contract-generate');
      if (btn) btn.disabled = true;
      try {
        const res = await contractsAPI.generate(payload);
        showToast('Contrato gerado com sucesso!', 'success');
        document.getElementById('contract-form').reset();
        await load();
        renderList();
        if (res.data?.warnings?.length) {
          const msgs = res.data.warnings.map(w => `• ${w.titulo}`).join('\n');
          alert(`Alertas da minuta:\n${msgs}`);
        }
      } catch (err) {
        showToast(err?.response?.data?.error || 'Falha ao gerar contrato.', 'error');
      } finally {
        if (btn) btn.disabled = false;
      }
    });
  }

  async function refresh() {
    await renderContractsPanel();
  }

  return { renderContractsPanel, refresh };
}

export default initContractsModule;
