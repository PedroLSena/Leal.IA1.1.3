/**
 * Leal.ai - Módulo do Organograma Visual em Árvore Hierárquica
 */

import { sanitizeHTML } from '../utils/helpers.js';

export function initOrganogramModule(AppState, { onOpenAccountDetails }) {
  function renderOrganogramTree() {
    const container = document.getElementById('org-tree-content');
    if (!container) return;

    // Agrupa contas por organização
    const orgMap = {};
    AppState.accounts.forEach(acc => {
      const orgName = acc.organization || 'Organização';
      if (!orgMap[orgName]) {
        orgMap[orgName] = {
          name: orgName,
          category: acc.category || 'empresa',
          members: []
        };
      }
      orgMap[orgName].members.push(acc);
    });

    container.innerHTML = Object.values(orgMap).map(org => {
      const catDef = AppState.definitions?.categories?.[org.category] || { icon: '🏢', name: 'Organização' };

      const tier1List = org.members.filter(m => m.tier === 'tier-1');
      const tier2List = org.members.filter(m => m.tier === 'tier-2');
      const tier3List = org.members.filter(m => m.tier === 'tier-3');
      const tier4List = org.members.filter(m => m.tier === 'tier-4');
      const tier5List = org.members.filter(m => m.tier === 'tier-5');

      return `
        <div class="tree-node-group" style="margin-bottom: 40px;">
          <!-- Topo da Organização -->
          <div class="tree-root">
            <span style="font-size: 24px;">${catDef.icon}</span>
            <div>
              <strong style="font-size: 16px; font-family: var(--font-display);">${sanitizeHTML(org.name)}</strong>
              <span style="display: block; font-size: 12px; opacity: 0.85;">${catDef.name} • ${org.members.length} colaboradores cadastrados</span>
            </div>
          </div>

          <!-- Nível 1: Sócios Titulares / C-Level -->
          <div class="tree-branch">
            <div style="font-size: 11.5px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px;">
              Nível 1 — Governança & Diretoria Executiva
            </div>
            ${tier1List.map(m => renderTreeNodeItem(m)).join('')}

            <!-- Nível 2: Gestores e Coordenadores -->
            ${tier2List.length > 0 ? `
              <div class="tree-node-sub">
                <div style="font-size: 11px; font-weight: 700; color: var(--green-dark); text-transform: uppercase;">
                  Nível 2 — Coordenação Jurídica & Gestão de Setores (RH / DP / TI)
                </div>
                ${tier2List.map(m => renderTreeNodeItem(m)).join('')}

                <!-- Nível 3 & 4: Operacional e Estágio -->
                ${(tier3List.length > 0 || tier4List.length > 0) ? `
                  <div class="tree-node-sub" style="border-left-color: var(--line);">
                    <div style="font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase;">
                      Nível 3 & 4 — Operacional, Advogados Associados & Paralegais
                    </div>
                    ${tier3List.map(m => renderTreeNodeItem(m)).join('')}
                    ${tier4List.map(m => renderTreeNodeItem(m)).join('')}
                  </div>
                ` : ''}

                <!-- Nível 5: Usuários Finais e Prestadores PJ -->
                ${tier5List.length > 0 ? `
                  <div class="tree-node-sub" style="border-left-color: #fbcfe8;">
                    <div style="font-size: 11px; font-weight: 700; color: #9d174d; text-transform: uppercase;">
                      Nível 5 — Colaboradores, Empregados & Prestadores PJ
                    </div>
                    ${tier5List.map(m => renderTreeNodeItem(m)).join('')}
                  </div>
                ` : ''}
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    // Listener para nós da árvore
    container.querySelectorAll('.tree-node').forEach(node => {
      const open = () => onOpenAccountDetails(node.dataset.id);
      node.addEventListener('click', open);
      node.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      });
    });
  }

  function renderTreeNodeItem(user) {
    const tierDef = AppState.definitions?.tiers?.[user.tier] || { badgeClass: '' };
    return `
      <div class="tree-node" data-id="${user.id}" tabindex="0" role="button" aria-label="Abrir detalhes de ${sanitizeHTML(user.name)}" style="cursor: pointer;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div class="user-avatar-cell" style="width: 32px; height: 32px; font-size: 11px;">${user.avatar || 'LA'}</div>
          <div>
            <strong style="font-size: 13.5px; color: var(--ink);">${sanitizeHTML(user.name)}</strong>
            <span style="display: block; font-size: 11.5px; color: var(--muted);">${sanitizeHTML(user.roleName || user.role)} • ${sanitizeHTML(user.sector)}</span>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="badge-hierarchy ${tierDef.badgeClass}" style="font-size: 10px;">${user.tier.toUpperCase()}</span>
          ${user.oab && user.oab !== 'Não aplicável' && user.oab !== 'Não informada' ? `<span style="font-size: 11px; font-weight: 600; color: var(--green-dark); background: var(--green-light); padding: 2px 6px; border-radius: 4px;">⚖️ ${sanitizeHTML(user.oab)}</span>` : ''}
        </div>
      </div>
    `;
  }

  return {
    renderOrganogramTree
  };
}

export default {
  initOrganogramModule
};
