/**
 * Leal.ai - Módulo de Gestão de Contas (Tabela, Ações e Modal de Detalhes)
 */

import { accountsAPI, TokenService } from '../services/api.js';
import { showToast, sanitizeHTML, createFocusTrap } from '../utils/helpers.js';

export function initAccountsModule(AppState, { onAccountsUpdated, onSimulateAccount }) {
  const searchInput = document.getElementById('filter-search');
  const catFilter = document.getElementById('filter-category');
  const tierFilter = document.getElementById('filter-tier');
  const pageSizeSelect = document.getElementById('accounts-page-size');
  let currentPage = 1;
  let pageSize = Number(pageSizeSelect?.value) || 8;

  let accountTrap = null;

  searchInput?.addEventListener('input', (e) => {
    AppState.filters.search = e.target.value.toLowerCase();
    currentPage = 1;
    renderAccountsTable();
  });

  catFilter?.addEventListener('change', (e) => {
    AppState.filters.category = e.target.value;
    currentPage = 1;
    renderAccountsTable();
  });

  tierFilter?.addEventListener('change', (e) => {
    AppState.filters.tier = e.target.value;
    currentPage = 1;
    renderAccountsTable();
  });

  pageSizeSelect?.addEventListener('change', (e) => {
    pageSize = Number(e.target.value) || 8;
    currentPage = 1;
    renderAccountsTable();
  });

  document.querySelectorAll('.view-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchViewMode(btn.dataset.view);
    });
  });

  // Fecha modal com clique fora ou botão fechar
  document.getElementById('btn-close-modal')?.addEventListener('click', closeAccountModal);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.getElementById('account-details-modal')?.classList.contains('active')) {
      closeAccountModal();
    }
  });

  function switchViewMode(mode) {
    document.querySelectorAll('.view-toggle-btn').forEach(b => {
      const isCurrent = b.dataset.view === mode;
      b.classList.toggle('active', isCurrent);
      b.setAttribute('aria-pressed', isCurrent ? 'true' : 'false');
    });
    const tableView = document.getElementById('accounts-table-container');
    const treeView = document.getElementById('accounts-tree-container');

    if (tableView) tableView.style.display = mode === 'table' ? 'block' : 'none';
    if (treeView) treeView.style.display = mode === 'tree' ? 'block' : 'none';
  }

  function renderAccountsTable() {
    const tableBody = document.getElementById('accounts-table-body');
    if (!tableBody) return;

    const filtered = AppState.accounts.filter(acc => {
      const q = AppState.filters.search;
      const matchesSearch = !q ||
        acc.name.toLowerCase().includes(q) ||
        acc.email.toLowerCase().includes(q) ||
        (acc.organization && acc.organization.toLowerCase().includes(q)) ||
        (acc.sector && acc.sector.toLowerCase().includes(q)) ||
        ((acc.roleName || acc.role) && (acc.roleName || acc.role).toLowerCase().includes(q));

      const matchesCat = AppState.filters.category === 'all' || acc.category === AppState.filters.category;
      const matchesTier = AppState.filters.tier === 'all' || acc.tier === AppState.filters.tier;

      return matchesSearch && matchesCat && matchesTier;
    });
    const pagination = document.getElementById('accounts-pagination');

    if (filtered.length === 0) {
      const isAuthed = TokenService.getAccessToken();
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 48px 20px; color: var(--muted);">
            ${isAuthed
              ? 'Nenhuma conta encontrada para os filtros selecionados.'
              : 'Faça login para visualizar e gerenciar as contas da sua organização.'}
          </td>
        </tr>
      `;
      if (pagination) pagination.innerHTML = '';
      return;
    }

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    currentPage = Math.min(currentPage, totalPages);
    const firstIndex = (currentPage - 1) * pageSize;
    const pageItems = filtered.slice(firstIndex, firstIndex + pageSize);

    tableBody.innerHTML = pageItems.map(acc => {
      const tierDef = AppState.definitions?.tiers?.[acc.tier] || { name: acc.tier, badgeClass: '' };
      const catDef = AppState.definitions?.categories?.[acc.category] || { icon: '💼', name: acc.category };

      return `
        <tr>
          <td>
            <div class="user-cell">
              <div class="user-avatar-cell">${acc.avatar || 'LA'}</div>
              <div class="user-info-text">
                <strong>${sanitizeHTML(acc.name)}</strong>
                <span>${sanitizeHTML(acc.email)}</span>
              </div>
            </div>
          </td>
          <td>
            <strong>${sanitizeHTML(acc.organization)}</strong>
            <span style="display:block; font-size:11.5px; color:var(--muted);">${catDef.icon} ${sanitizeHTML(catDef.name)}</span>
          </td>
          <td>
            <strong>${sanitizeHTML(acc.roleName || acc.role)}</strong>
            <span style="display:block; font-size:11.5px; color:var(--muted);">${sanitizeHTML(acc.sector)}</span>
          </td>
          <td>
            <span class="badge-hierarchy ${tierDef.badgeClass}">
              ${acc.tier.toUpperCase()} — ${tierDef.name?.split('—')[1] || tierDef.name}
            </span>
          </td>
          <td>
            <span style="font-size:12px; color:var(--ink);">${sanitizeHTML(acc.reportsTo || '—')}</span>
          </td>
          <td>
            <span class="status-badge ${acc.status === 'active' ? 'status-active' : 'status-disabled'}">
              ${acc.status === 'active' ? '● Ativo' : '○ Inativo'}
            </span>
          </td>
          <td>
            <div class="action-buttons-group">
              <button 
                class="btn-icon" 
                title="Ver Detalhes & Permissões" 
                aria-label="Ver detalhes da conta de ${sanitizeHTML(acc.name)}"
                data-action="details" 
                data-id="${acc.id}">👁</button>
              <button 
                class="btn-icon" 
                title="Simular Acesso na Plataforma" 
                aria-label="Simular painel do usuário ${sanitizeHTML(acc.name)}"
                data-action="simulate" 
                data-id="${acc.id}">🚀</button>
              <button 
                class="btn-icon" 
                title="Alternar Status Ativo/Inativo" 
                aria-label="Alternar status ativo da conta de ${sanitizeHTML(acc.name)}"
                data-action="toggle" 
                data-id="${acc.id}">🔄</button>
              <button 
                class="btn-icon" 
                title="Remover Conta" 
                aria-label="Excluir conta de ${sanitizeHTML(acc.name)}"
                data-action="delete" 
                data-id="${acc.id}" 
                style="color:var(--danger)">🗑</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    renderPagination(pagination, filtered.length, totalPages, firstIndex);

    // Event delegation para botões de ação na tabela
    tableBody.querySelectorAll('button[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const action = btn.dataset.action;
        if (action === 'details') openAccountModal(id);
        if (action === 'simulate') onSimulateAccount(id);
        if (action === 'toggle') toggleAccountStatus(id);
        if (action === 'delete') deleteAccount(id);
      });
    });
  }

  function renderPagination(container, total, totalPages, firstIndex) {
    if (!container) return;
    const start = firstIndex + 1;
    const end = Math.min(firstIndex + pageSize, total);
    const pageButtons = Array.from({ length: totalPages }, (_, index) => index + 1)
      .filter(page => totalPages <= 7 || page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
      .map((page, index, pages) => {
        const previous = pages[index - 1];
        const gap = previous && page - previous > 1 ? '<span class="pagination-ellipsis" aria-hidden="true">…</span>' : '';
        return `${gap}<button class="pagination-button ${page === currentPage ? 'active' : ''}" type="button" data-page="${page}" aria-label="Página ${page}" ${page === currentPage ? 'aria-current="page"' : ''}>${page}</button>`;
      }).join('');

    container.innerHTML = `
      <span class="pagination-summary">Exibindo ${start}–${end} de ${total} contas</span>
      <div class="pagination-controls" aria-label="Paginação da tabela de contas">
        <button class="pagination-button" type="button" data-page="${currentPage - 1}" aria-label="Página anterior" ${currentPage === 1 ? 'disabled' : ''}>‹</button>
        ${pageButtons}
        <button class="pagination-button" type="button" data-page="${currentPage + 1}" aria-label="Próxima página" ${currentPage === totalPages ? 'disabled' : ''}>›</button>
      </div>`;

    container.querySelectorAll('button[data-page]').forEach(button => {
      button.addEventListener('click', () => {
        const nextPage = Number(button.dataset.page);
        if (nextPage < 1 || nextPage > totalPages || nextPage === currentPage) return;
        currentPage = nextPage;
        renderAccountsTable();
      });
    });
  }

  async function toggleAccountStatus(id) {
    const acc = AppState.accounts.find(a => a.id === id);
    if (!acc) return;

    const nextStatus = acc.status === 'active' ? 'disabled' : 'active';
    try {
      await accountsAPI.updateStatus(id, nextStatus);
      acc.status = nextStatus;
      renderAccountsTable();
      showToast(`Status da conta de ${acc.name} alterado para "${nextStatus === 'active' ? 'Ativo' : 'Inativo'}".`, 'success');
      if (onAccountsUpdated) onAccountsUpdated();
    } catch (err) {
      showToast('Falha ao alterar status na API.', 'error');
    }
  }

  async function deleteAccount(id) {
    const acc = AppState.accounts.find(a => a.id === id);
    if (!acc) return;

    if (confirm(`Tem certeza que deseja excluir a conta de ${acc.name} (${acc.roleName || acc.role})?`)) {
      try {
        await accountsAPI.delete(id);
        AppState.accounts = AppState.accounts.filter(a => a.id !== id);
        renderAccountsTable();
        showToast(`Conta de ${acc.name} removida da API.`, 'success');
        if (onAccountsUpdated) onAccountsUpdated();
      } catch (err) {
        showToast('Falha ao excluir conta na API.', 'error');
      }
    }
  }

  function openAccountModal(id) {
    const acc = AppState.accounts.find(a => a.id === id);
    if (!acc) return;

    const modal = document.getElementById('account-details-modal');
    const body = document.getElementById('modal-account-content');
    if (!modal || !body) return;

    const tierDef = AppState.definitions?.tiers?.[acc.tier] || { name: acc.tier, description: '' };
    const catDef = AppState.definitions?.categories?.[acc.category] || { icon: '💼', name: acc.category };

    body.innerHTML = `
      <div style="display: flex; gap: 16px; align-items: center; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid var(--line-light);">
        <div class="id-avatar" style="width: 56px; height: 56px; font-size: 20px;">${acc.avatar || 'LA'}</div>
        <div>
          <h2 style="font-family:'Plus Jakarta Sans'; font-size: 20px; color: var(--ink);">${sanitizeHTML(acc.name)}</h2>
          <span style="color: var(--muted); font-size: 13.5px;">${sanitizeHTML(acc.email)}</span>
          <div style="margin-top: 6px; display: flex; gap: 8px;">
            <span class="badge-hierarchy ${tierDef.badgeClass}">${acc.tier.toUpperCase()} — ${tierDef.name?.split('—')[1] || tierDef.name}</span>
            <span class="status-badge ${acc.status === 'active' ? 'status-active' : 'status-disabled'}">${acc.status === 'active' ? '● Ativo' : '○ Inativo'}</span>
          </div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px;">
        <div style="background: var(--cream-card); padding: 12px 16px; border-radius: 8px;">
          <span style="font-size: 11.5px; color: var(--muted); font-weight: 600; text-transform: uppercase;">Organização</span>
          <strong style="display: block; font-size: 14px; margin-top: 2px;">${sanitizeHTML(acc.organization)}</strong>
          <span style="font-size: 12px; color: var(--muted);">${catDef.icon} ${sanitizeHTML(catDef.name)}</span>
        </div>

        <div style="background: var(--cream-card); padding: 12px 16px; border-radius: 8px;">
          <span style="font-size: 11.5px; color: var(--muted); font-weight: 600; text-transform: uppercase;">Setor & Cargo</span>
          <strong style="display: block; font-size: 14px; margin-top: 2px;">${sanitizeHTML(acc.roleName || acc.role)}</strong>
          <span style="font-size: 12px; color: var(--muted);">${sanitizeHTML(acc.sector)}</span>
        </div>

        <div style="background: var(--cream-card); padding: 12px 16px; border-radius: 8px;">
          <span style="font-size: 11.5px; color: var(--muted); font-weight: 600; text-transform: uppercase;">CNPJ / CPF</span>
          <strong style="display: block; font-size: 14px; margin-top: 2px;">${sanitizeHTML(acc.cnpjCpf || '—')}</strong>
        </div>

        <div style="background: var(--cream-card); padding: 12px 16px; border-radius: 8px;">
          <span style="font-size: 11.5px; color: var(--muted); font-weight: 600; text-transform: uppercase;">Inscrição OAB</span>
          <strong style="display: block; font-size: 14px; margin-top: 2px;">${sanitizeHTML(acc.oab || 'Não informada')}</strong>
        </div>

        <div style="background: var(--cream-card); padding: 12px 16px; border-radius: 8px;">
          <span style="font-size: 11.5px; color: var(--muted); font-weight: 600; text-transform: uppercase;">Subordinação (Reporta a)</span>
          <strong style="display: block; font-size: 14px; margin-top: 2px;">${sanitizeHTML(acc.reportsTo || 'Conselho')}</strong>
        </div>

        <div style="background: var(--cream-card); padding: 12px 16px; border-radius: 8px;">
          <span style="font-size: 11.5px; color: var(--muted); font-weight: 600; text-transform: uppercase;">ID Seguro (UUID)</span>
          <strong style="display: block; font-size: 11px; margin-top: 2px; font-family: monospace;">${acc.id}</strong>
        </div>
      </div>

      <div>
        <h4 style="font-family:'Plus Jakarta Sans'; font-size: 15px; margin-bottom: 12px; color: var(--ink);">Permissões Ativas no Backend (RBAC)</h4>
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          ${(AppState.permissionsCatalog || []).map(perm => {
            const isAllowed = acc.permissions?.includes(perm.id);
            return `
              <span style="font-size: 12px; padding: 6px 12px; border-radius: 6px; border: 1px solid ${isAllowed ? 'var(--green)' : 'var(--line-light)'}; background: ${isAllowed ? 'var(--green-light)' : '#f8fafc'}; color: ${isAllowed ? 'var(--green-dark)' : 'var(--muted)'}; font-weight: 600;">
                ${isAllowed ? '✓' : '✗'} ${sanitizeHTML(perm.name || perm.label)}
              </span>
            `;
          }).join('')}
        </div>
      </div>

      <div style="margin-top: 28px; display: flex; justify-content: flex-end; gap: 12px;">
        <button class="btn-secondary" id="modal-action-close">Fechar</button>
        <button class="btn-primary" id="modal-action-simulate">Simular Visão deste Perfil ↗</button>
      </div>
    `;

    document.getElementById('modal-action-close')?.addEventListener('click', closeAccountModal);
    document.getElementById('modal-action-simulate')?.addEventListener('click', () => {
      closeAccountModal();
      onSimulateAccount(acc.id);
    });

    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    accountTrap = createFocusTrap(modal);
    accountTrap.activate();
  }

  function closeAccountModal() {
    const modal = document.getElementById('account-details-modal');
    if (modal) {
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
      if (accountTrap) { accountTrap.deactivate(); accountTrap = null; }
    }
  }

  return {
    renderAccountsTable,
    openAccountModal,
    closeAccountModal
  };
}

export default {
  initAccountsModule
};
