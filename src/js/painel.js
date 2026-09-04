/**
 * Leal.ai — Painel Pessoal
 * Lê o cadastro persistido (banco local IndexedDB + backend quando disponível)
 * e apresenta os dados do usuário: identidade, hierarquia, permissões e plano.
 */

import { localDb } from './services/localDb.js';

/* Acesso leve à sessão do backend (sem dependências de bundler) */
const getToken = () =>
  localStorage.getItem('leal_access_token') || sessionStorage.getItem('leal_access_token');

async function fetchMe(token) {
  const base = window.location.port === '5173' ? '/api' : (/localhost|127\.0\.0\.1/.test(window.location.origin) ? 'http://localhost:3001/api' : '/api');
  const res = await fetch(`${base}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('sessão inválida');
  const data = await res.json();
  return data.user;
}

const PERM_LABELS = {
  contract_generate: 'Gerar contratos com IA',
  contract_approve: 'Aprovar e assinar contratos',
  journey_view: 'Consultar jornadas de trabalho',
  journey_manage: 'Gerenciar e corrigir jornadas',
  risk_view: 'Visualizar auditoria de riscos',
  risk_manage: 'Tratar e encerrar riscos',
  team_manage: 'Gestão de hierarquia e usuários',
  billing_manage: 'Gestão de plano e faturamento',
  audit_view: 'Consultar trilha de auditoria',
};

const TIER_LABELS = {
  'tier-1': 'Tier 1 — Direção / Titular',
  'tier-2': 'Tier 2 — Gestão',
  'tier-3': 'Tier 3 — Coordenação',
  'tier-4': 'Tier 4 — Operação',
  'tier-5': 'Tier 5 — Acesso restrito',
};

const $ = (id) => document.getElementById(id);

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function esc(v) {
  return String(v ?? '—').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

function initials(name = '') {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0] || '')
      .join('')
      .toUpperCase() || '??'
  );
}

function renderUser(user, total) {
  $('p-avatar').textContent = user.avatar || initials(user.name);
  $('p-avatar').classList.remove('leal-skeleton');

  const nameEl = $('p-name');
  nameEl.classList.remove('leal-skeleton');
  nameEl.textContent = user.name || 'Usuário Leal.ai';

  $('p-status-line').textContent = user.syncedWithApi
    ? 'cadastro sincronizado com o banco de dados'
    : 'cadastro salvo no banco local do portal';

  $('p-subtitle').textContent = `${user.roleName || 'Colaborador'} • ${user.organization || 'Organização'}`;

  $('p-chips').innerHTML = [
    `<span class="ok">${esc(TIER_LABELS[user.tier] || user.tier || 'Tier —')}</span>`,
    `<span>${esc(user.sector || 'Setor não informado')}</span>`,
    `<span>Plano ${esc(user.plan || 'Pro')}</span>`,
    user.syncedWithApi
      ? '<span class="ok">Persistido no PostgreSQL</span>'
      : '<span class="warn">Somente banco local</span>',
  ].join('');

  const perms = user.permissions || [];
  $('p-stats').innerHTML = [
    { v: perms.length, l: 'Permissões ativas' },
    { v: (user.tier || '—').toString().replace('tier-', 'T'), l: 'Nível hierárquico' },
    { v: total, l: 'Cadastros no banco' },
    { v: user.status === 'active' ? 'Ativo' : 'Inativo', l: 'Status da conta' },
  ]
    .map((s) => `<div class="stat-card"><strong>${esc(s.v)}</strong><span>${esc(s.l)}</span></div>`)
    .join('');

  const rows = [
    ['Nome completo', user.name],
    ['E-mail corporativo', user.email],
    ['Organização', user.organization],
    ['CNPJ / CPF', user.cnpjCpf],
    ['Categoria', user.category],
    ['Cargo', user.roleName || user.role],
    ['Setor', user.sector],
    ['Reporta-se a', user.reportsTo],
    ['OAB', user.oab],
    ['Plano contratado', user.plan],
    ['Criado em', fmtDate(user.createdAt)],
    ['ID do registro', user.id],
  ];
  $('p-data').innerHTML = rows
    .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v || '—')}</dd></div>`)
    .join('');

  const allPerms = Object.keys(PERM_LABELS);
  const list = allPerms.map((key) => {
    const on = perms.includes(key);
    return `<li class="${on ? '' : 'off'}"><i>${on ? '✓' : '✗'}</i>${esc(PERM_LABELS[key])}</li>`;
  });
  perms.filter((p) => !PERM_LABELS[p]).forEach((p) => list.push(`<li><i>✓</i>${esc(p)}</li>`));
  $('p-perms').innerHTML = list.join('');

  $('p-plan').innerHTML =
    `<strong>Plano ${esc(user.plan || 'Pro')}</strong>` +
    'Contratos ilimitados com IA, auditoria preditiva de riscos e monitoramento de jornada para toda a hierarquia da organização.';
}

function renderTable(rows, currentId) {
  const tbody = document.querySelector('#p-table tbody');
  tbody.innerHTML = rows
    .map(
      (r) => `
      <tr class="${r.id === currentId ? 'is-current' : ''}">
        <td>${esc(r.name)}</td>
        <td>${esc(r.email)}</td>
        <td>${esc(r.roleName || r.role)}</td>
        <td>${esc(r.organization)}</td>
        <td>${fmtDate(r.createdAt)}</td>
        <td><span class="tag-db ${r.syncedWithApi ? 'api' : 'local'}">${r.syncedWithApi ? 'PostgreSQL' : 'Banco local'}</span></td>
        <td><button class="row-link" data-open="${esc(r.id)}">Ver painel →</button></td>
      </tr>`
    )
    .join('');

  tbody.querySelectorAll('[data-open]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-open');
      localDb.setCurrentId(id);
      window.location.search = `?id=${encodeURIComponent(id)}`;
    });
  });
}

async function boot() {
  const params = new URLSearchParams(window.location.search);
  const rows = await localDb.list();
  let id = params.get('id') || localDb.getCurrentId();
  let user = (await localDb.get(id)) || rows[0] || null;

  // Enriquecimento opcional com a sessão autenticada do backend
  const token = getToken();
  if (token) {
    try {
      const me = await fetchMe(token);
      if (me && !user) user = { ...me, syncedWithApi: true, createdAt: me.created_at };
    } catch {
      /* backend indisponível — segue com o banco local */
    }
  }

  if (!user) {
    $('panel-hero').hidden = true;
    $('p-stats').hidden = true;
    document.querySelector('.panel-grid').hidden = true;
    $('p-empty').hidden = false;
    $('p-db-hint').textContent = 'Nenhum registro persistido até o momento.';
    return;
  }

  localDb.setCurrentId(user.id);
  renderUser(user, rows.length);
  renderTable(rows, user.id);
  $('p-db-hint').textContent = `${rows.length} registro(s) no banco do portal (IndexedDB "leal_ai_db"), sincronizados com o PostgreSQL quando o backend está ativo.`;

  $('btn-export')?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'leal-ai-cadastros.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });
  $('btn-new')?.addEventListener('click', () => {
    window.location.href = 'cadastro.html#novo';
  });
}

boot();
