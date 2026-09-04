/**
 * Leal.ai - Módulo do Auditor de Riscos Trabalhistas (Painel)
 * Questionário de conformidade + termômetro de risco + recomendações acionáveis.
 * Consome o endpoint /api/risk/analyze (motor determinístico baseado na CLT).
 */

import { riskAPI } from '../services/api.js';
import { showToast, sanitizeHTML } from '../utils/helpers.js';

const QUESTION_GROUPS = [
  {
    key: 'jornada',
    label: 'Jornada de Trabalho',
    questions: [
      {
        key: 'jornadaExtraFrequente',
        label: 'Há realização frequente de horas extras sem controle formal de ponto?',
        options: [['sim', 'Sim'], ['nao', 'Não']]
      },
      {
        key: 'intervaloIntrajornada',
        label: 'O intervalo intrajornada (mín. 1h) é concedido em jornadas > 6h?',
        options: [['sim', 'Sim'], ['nao', 'Não']]
      }
    ]
  },
  {
    key: 'remuneracao',
    label: 'Remuneração',
    questions: [
      {
        key: 'remuneracaoPiso',
        label: 'A remuneração respeita o piso salarial / convenção coletiva da categoria?',
        options: [['sim', 'Sim'], ['nao', 'Não']]
      },
      {
        key: 'adiantamentoSemComprovacao',
        label: 'Há adiantamentos salariais sem comprovação documental formal?',
        options: [['sim', 'Sim'], ['nao', 'Não']]
      }
    ]
  },
  {
    key: 'terceirizacao',
    label: 'Terceirização',
    questions: [
      {
        key: 'terceirizacaoAtividadeFim',
        label: 'Há terceirização de atividade-fim sem vínculo formal?',
        options: [['sim', 'Sim'], ['nao', 'Não']]
      },
      {
        key: 'terceirizacaoSemSupervisao',
        label: 'Prestadores atuam sob subordinação direta (pessoalidade)?',
        options: [['sim', 'Sim'], ['nao', 'Não']]
      }
    ]
  },
  {
    key: 'banco_horas',
    label: 'Banco de Horas',
    questions: [
      {
        key: 'bancoHorasHomologado',
        label: 'O banco de horas está instituído por acordo/convenção coletiva homologada?',
        options: [['sim', 'Sim'], ['nao', 'Não']]
      }
    ]
  },
  {
    key: 'adicional',
    label: 'Adicionais (Insalubridade/Periculosidade)',
    questions: [
      {
        key: 'adicionalInsalubridade',
        label: 'Ambientes insalubres/periculosos têm o adicional correspondente pago?',
        options: [['sim', 'Sim'], ['nao', 'Não']]
      }
    ]
  },
  {
    key: 'contrato',
    label: 'Formalização Contratual',
    questions: [
      {
        key: 'contratoRegistro',
        label: 'Todos os trabalhadores estão registrados em CTPS (eSocial)?',
        options: [['sim', 'Sim'], ['nao', 'Não']]
      }
    ]
  },
  {
    key: 'dumping',
    label: 'Práticas de Dumping Social',
    questions: [
      {
        key: 'menorAprendiz',
        label: 'A cota de aprendizes (empresas com 7+ funcionários) está cumprida?',
        options: [['sim', 'Sim'], ['nao', 'Não']]
      }
    ]
  }
];

const LEVEL_META = {
  low: { label: 'Baixo', color: '#16a34a', desc: 'Boa conformidade. Mantenha as boas práticas e revise periódicamente.' },
  medium: { label: 'Médio', color: '#ca8a04', desc: 'Alguns pontos de atenção exigem correção para evitar passivos.' },
  high: { label: 'Alto', color: '#ea580c', desc: 'Risco relevante. Corrija com prioridade e documente as ações.' },
  critical: { label: 'Crítico', color: '#dc2626', desc: 'Passivo trabalhista iminente. Ação urgente com apoio jurídico.' }
};

export function initRiskModule(AppState) {
  const state = {
    answers: {},
    lastResult: null,
    history: []
  };

  function renderRiskPanel() {
    const container = document.getElementById('risk-panel-content');
    if (!container) return;
    renderQuestionnaire(container);
    renderHistory(container);
  }

  function renderQuestionnaire(container) {
    const groupsHtml = QUESTION_GROUPS.map(group => `
      <fieldset class="risk-group">
        <legend>${sanitizeHTML(group.label)}</legend>
        ${group.questions.map((q, i) => `
          <div class="risk-question">
            <p class="risk-q-label">${sanitizeHTML(q.label)}</p>
            <div class="risk-options">
              ${q.options.map(([val, text]) => `
                <label class="risk-option ${state.answers[q.key] === val ? 'selected' : ''}">
                  <input type="radio" name="${q.key}" value="${val}"
                    ${state.answers[q.key] === val ? 'checked' : ''} />
                  <span>${text}</span>
                </label>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </fieldset>
    `).join('');

    container.innerHTML = `
      <div class="risk-layout">
        <div class="risk-form-card">
          <div class="risk-form-head">
            <h2>Auditor de Riscos Trabalhistas</h2>
            <p>Responda o questionário de conformidade. O motor analisa as respostas com base na CLT e legislação trabalhista e gera um score de risco explicável.</p>
          </div>
          <form id="risk-form" novalidate>
            <div class="risk-q-groups">${groupsHtml}</div>
            <div class="risk-form-foot">
              <button type="reset" class="btn-secondary" id="btn-risk-reset">Limpar</button>
              <button type="submit" class="btn-primary" id="btn-risk-submit">
                <span>⚖️</span> Analisar Riscos
              </button>
            </div>
          </form>
        </div>
        <div class="risk-result-card" id="risk-result-card">
          <div class="risk-result-placeholder" id="risk-result-placeholder">
            Preencha o questionário e clique em <strong>Analisar Riscos</strong> para ver o resultado.
          </div>
          <div class="risk-result-body" id="risk-result-body" style="display:none;"></div>
        </div>
      </div>
    `;

    container.querySelectorAll('.risk-option input').forEach(input => {
      input.addEventListener('change', (e) => {
        state.answers[e.target.name] = e.target.value;
        e.target.closest('.risk-options').querySelectorAll('.risk-option').forEach(opt =>
          opt.classList.toggle('selected', opt.querySelector('input').checked)
        );
      });
    });

    container.querySelector('#risk-form').addEventListener('submit', (e) => {
      e.preventDefault();
      runAnalysis();
    });
    container.querySelector('#btn-risk-reset').addEventListener('click', () => {
      state.answers = {};
      renderQuestionnaire(container);
    });
  }

  async function runAnalysis() {
    const btn = document.getElementById('btn-risk-submit');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Analisando...';
    }
    try {
      // Aplicar lógica invertida das perguntas para o motor de regras
      const answers = { ...state.answers };
      const result = await riskAPI.analyze({
        title: `Auditoria Trabalhista ${new Date().toLocaleDateString('pt-BR')}`,
        description: 'Preenchido via painel do Auditor de Riscos.',
        answers
      });
      state.lastResult = result.data;
      await loadHistory();
      renderResult();
      showToast('Análise de risco gerada com sucesso!', 'success');
    } catch (err) {
      const msg = (err?.response?.status === 403)
        ? 'Seu perfil não tem permissão para realizar auditorias. Contacte um administrador.'
        : (err?.response?.data?.error || 'Falha ao analisar riscos. Verifique sua conexão.');
      showToast(msg, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '⚖️  Analisar Riscos';
      }
    }
  }

  function renderResult() {
    const body = document.getElementById('risk-result-body');
    const placeholder = document.getElementById('risk-result-placeholder');
    if (!body) return;
    const r = state.lastResult;
    if (!r) return;

    const meta = LEVEL_META[r.level] || LEVEL_META.low;
    const findings = Array.isArray(r.findings) ? r.findings : [];
    const recommendations = Array.isArray(r.recommendations) ? r.recommendations : [];

    placeholder.style.display = 'none';
    body.style.display = 'block';
    body.innerHTML = `
      <div class="risk-score-head">
        <div class="risk-score-badge" style="background:${meta.color};">
          <strong>${r.score}</strong><span>/100</span>
        </div>
        <div class="risk-score-meta">
          <h3>Risco Trabalhista: <span style="color:${meta.color};">${meta.label}</span></h3>
          <p>${meta.desc}</p>
        </div>
      </div>
      <div class="risk-thermometer">
        <div class="risk-thermo-track">
          <div class="risk-thermo-fill" style="width:${Math.min(100, r.score || 0)}%; background:${meta.color};"></div>
          ${[25, 50, 75].map(p => `<span class="risk-thermo-mark" style="left:${p}%"></span>`).join('')}
        </div>
        <div class="risk-thermo-labels"><span>Baixo</span><span>Médio</span><span>Alto</span><span>Crítico</span></div>
      </div>

      <h4 class="risk-sec-title">🔎 Achados (${findings.length})</h4>
      ${findings.length ? findings.map(f => `
        <div class="risk-finding severity-${f.severity || 'medio'}">
          <span class="risk-sev-pill">${(f.severity || 'medio').toUpperCase()}</span>
          <div>
            <strong>${sanitizeHTML(f.title || '')}</strong>
            <span class="risk-finding-cat">${sanitizeHTML(f.category || '')}</span>
          </div>
        </div>
      `).join('') : '<p class="risk-empty">Nenhum achado de risco identificado.</p>'}

      <h4 class="risk-sec-title">✅ Recomendações Acionáveis</h4>
      ${recommendations.length ? recommendations.map(rec => `
        <div class="risk-recommendation">
          <span class="risk-rec-icon">→</span>
          <span>${sanitizeHTML(rec)}</span>
        </div>
      `).join('') : '<p class="risk-empty">Nenhuma recomendação pendente.</p>'}
    `;
  }

  async function loadHistory() {
    try {
      const items = await riskAPI.list();
      state.history = items;
    } catch (e) {
      state.history = [];
    }
  }

  async function renderHistory(container) {
    const historyEl = document.getElementById('risk-history-list');
    if (!historyEl) return;
    try {
      const items = await riskAPI.list();
      state.history = items;
      if (!items.length) {
        historyEl.innerHTML = '<p class="risk-empty">Nenhuma auditoria salva ainda.</p>';
        return;
      }
      historyEl.innerHTML = items.map(r => {
        const meta = LEVEL_META[r.risk_level] || LEVEL_META.low;
        return `
          <div class="risk-history-item" data-id="${r.id}" data-title="${sanitizeHTML(r.title || '')}">
            <span class="risk-history-score" style="background:${meta.color};">${r.risk_score}</span>
            <div class="risk-history-meta">
              <strong>${sanitizeHTML(r.title || 'Sem título')}</strong>
              <span>${r.status} · ${(r.created_at || '').slice(0, 10)}</span>
            </div>
            <button class="btn-delete-risk" data-id="${r.id}" title="Excluir">🗑</button>
          </div>
        `;
      }).join('');

      historyEl.querySelectorAll('.risk-history-item').forEach(item => {
        item.addEventListener('click', (e) => {
          if (e.target.classList.contains('btn-delete-risk')) return;
          openRiskDetail(item.dataset.id);
        });
      });
      historyEl.querySelectorAll('.btn-delete-risk').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!confirm('Deseja excluir esta auditoria?')) return;
          try {
            await riskAPI.remove(btn.dataset.id);
            showToast('Auditoria excluída.', 'success');
            await renderHistory(container);
          } catch (err) {
            showToast('Falha ao excluir auditoria.', 'error');
          }
        });
      });
    } catch (e) {
      historyEl.innerHTML = '<p class="risk-empty">Não foi possível carregar o histórico.</p>';
    }
  }

  async function openRiskDetail(id) {
    try {
      const r = await riskAPI.getById(id);
      if (!r) return;
      state.lastResult = r;
      renderResult();
      const placeholder = document.getElementById('risk-result-placeholder');
      if (placeholder) placeholder.style.display = 'none';
      const body = document.getElementById('risk-result-body');
      if (body) {
        body.style.display = 'block';
        body.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } catch (err) {
      showToast('Falha ao carregar a auditoria.', 'error');
    }
  }

  return {
    renderRiskPanel,
    refreshHistory: () => renderHistory(document.getElementById('risk-panel-content'))
  };
}

export default initRiskModule;
