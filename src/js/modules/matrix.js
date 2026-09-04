/**
 * Leal.ai - Módulo da Matriz de Permissões RBAC
 */

import { sanitizeHTML } from '../utils/helpers.js';

export function initMatrixModule(AppState) {
  function renderPermissionsMatrix() {
    const container = document.getElementById('matrix-table-container');
    if (!container || !AppState.definitions?.tiers || !AppState.permissionsCatalog) return;

    const tiers = ['tier-1', 'tier-2', 'tier-3', 'tier-4', 'tier-5'];

    container.innerHTML = `
      <table class="matrix-table">
        <thead>
          <tr>
            <th>Módulo / Recurso do Sistema</th>
            ${tiers.map(t => {
              const tDef = AppState.definitions.tiers[t];
              return `<th>${t.toUpperCase()}<br><small style="font-weight:normal; opacity:0.85;">${sanitizeHTML(tDef?.name?.split('—')[1] || '')}</small></th>`;
            }).join('')}
          </tr>
        </thead>
        <tbody>
          ${AppState.permissionsCatalog.map(perm => `
            <tr>
              <td>
                <strong>${sanitizeHTML(perm.name || perm.label)}</strong>
                <div style="font-size:11.5px; color:var(--muted); margin-top:2px;">${sanitizeHTML(perm.description || perm.desc)}</div>
              </td>
              ${tiers.map(t => {
                const tierDef = AppState.definitions.tiers[t];
                const hasPerm = tierDef?.defaultPerms?.includes(perm.id);
                return `
                  <td>
                    ${hasPerm ? '<span class="perm-check-yes" aria-label="Permitido">✓</span>' : '<span class="perm-check-no" aria-label="Negado">—</span>'}
                  </td>
                `;
              }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  return {
    renderPermissionsMatrix
  };
}

export default {
  initMatrixModule
};
