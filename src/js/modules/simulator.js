/**
 * Leal.ai - Módulo do Simulador de Perfil e Escopo Hierárquico
 */

import { sanitizeHTML } from '../utils/helpers.js';

export function initSimulatorModule(AppState) {
  function renderSimulator() {
    renderSimulatorUserPicker();
    renderSimulatorScreen();
  }

  function renderSimulatorUserPicker() {
    const container = document.getElementById('sim-users-list');
    if (!container) return;

    if (!AppState.selectedSimUser && AppState.accounts.length > 0) {
      AppState.selectedSimUser = AppState.accounts[0];
    }

    container.innerHTML = AppState.accounts.map(u => `
      <div class="sim-user-item ${AppState.selectedSimUser?.id === u.id ? 'selected' : ''}" data-id="${u.id}" tabindex="0" role="button" aria-pressed="${AppState.selectedSimUser?.id === u.id}">
        <div class="user-avatar-cell" style="width: 34px; height: 34px; font-size: 12px;">${u.avatar || 'LA'}</div>
        <div style="flex: 1; overflow: hidden;">
          <strong style="display: block; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${sanitizeHTML(u.name)}</strong>
          <span style="font-size: 11.5px; color: var(--muted);">${sanitizeHTML(u.roleName || u.role)}</span>
        </div>
        <span class="badge-hierarchy ${AppState.definitions?.tiers?.[u.tier]?.badgeClass || ''}" style="font-size: 9.5px;">${u.tier.toUpperCase()}</span>
      </div>
    `).join('');

    container.querySelectorAll('.sim-user-item').forEach(item => {
      const selectUser = () => {
        selectSimUser(item.dataset.id);
      };
      item.addEventListener('click', selectUser);
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectUser();
        }
      });
    });
  }

  function selectSimUser(id) {
    AppState.selectedSimUser = AppState.accounts.find(a => a.id === id);
    renderSimulatorUserPicker();
    renderSimulatorScreen();
  }

  function renderSimulatorScreen() {
    const container = document.getElementById('sim-screen-container');
    if (!container) return;

    const user = AppState.selectedSimUser;
    if (!user) {
      container.innerHTML = `<p style="color:var(--muted); text-align:center; padding:40px;">Selecione um usuário para simular sua visualização na Leal.ai.</p>`;
      return;
    }

    const perms = user.permissions || [];
    const tierDef = AppState.definitions?.tiers?.[user.tier] || { name: user.tier };

    container.innerHTML = `
      <div class="sim-header-view">
        <div>
          <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.8;">Modo Simulação de Sessão Ativa</span>
          <h2 style="font-family: var(--font-display); font-size: 20px; margin-top: 4px;">Visão de: ${sanitizeHTML(user.name)}</h2>
          <span style="font-size: 13px; opacity: 0.9;">${sanitizeHTML(user.organization)} • ${sanitizeHTML(user.roleName || user.role)} (${tierDef.name})</span>
        </div>
        <div style="text-align: right;">
          <span class="badge-hierarchy ${tierDef.badgeClass || ''}" style="background: white; color: var(--ink); font-size: 12px;">
            ${user.tier.toUpperCase()}
          </span>
        </div>
      </div>

      <div style="margin-bottom: 24px;">
        <h3 style="font-family: var(--font-display); font-size: 16px; margin-bottom: 6px;">O que este usuário enxerga ao acessar a Leal.ai:</h3>
        <p style="color: var(--muted); font-size: 13px;">O sistema protege os dados confidenciais aplicando filtros automáticos de escopo hierárquico e governança.</p>
      </div>

      <div class="sim-modules-grid">
        <!-- Módulo 1: Geração de Contratos Trabalhistas IA -->
        <div class="sim-module-box ${perms.includes('contracts_create') ? '' : 'unauthorized'}">
          <span class="sim-module-badge ${perms.includes('contracts_create') ? 'badge-granted' : 'badge-denied'}">
            ${perms.includes('contracts_create') ? 'Acesso Concedido' : 'Bloqueado'}
          </span>
          <h4 style="font-size: 15px; margin-bottom: 4px;">📝 Geração de Contratos com IA</h4>
          <p style="font-size: 12.5px; color: var(--muted); margin-bottom: 12px;">
            ${perms.includes('contracts_create')
              ? (perms.includes('contracts_approve')
                  ? 'Pode gerar minutas, alterar cláusulas e aprovar contratos para assinatura com validade jurídica.'
                  : 'Pode redigir minutas com IA, mas o envio requer aprovação de um supervisor.')
              : 'Este perfil não possui permissão para gerar contratos trabalhistas.'}
          </p>
          <span style="font-size: 11.5px; font-weight: 700; color: ${perms.includes('contracts_create') ? 'var(--success)' : 'var(--danger)'};">
            ${perms.includes('contracts_create') ? '● Habilitado na barra de ferramentas' : '○ Ícone ocultado no menu'}
          </span>
        </div>

        <!-- Módulo 2: Auditor Preditivo de Passivos -->
        <div class="sim-module-box ${perms.includes('risk_view_all') || perms.includes('risk_view_sector') ? '' : 'unauthorized'}">
          <span class="sim-module-badge ${perms.includes('risk_view_all') || perms.includes('risk_view_sector') ? 'badge-granted' : 'badge-denied'}">
            ${perms.includes('risk_view_all') ? 'Global (Empresa Toda)' : (perms.includes('risk_view_sector') ? 'Restrito ao Setor' : 'Bloqueado')}
          </span>
          <h4 style="font-size: 15px; margin-bottom: 4px;">🛡️ Auditor Preditivo de Riscos</h4>
          <p style="font-size: 12.5px; color: var(--muted); margin-bottom: 12px;">
            ${perms.includes('risk_view_all')
              ? 'Acesso total aos scores financeiros e probabilidades de contingências trabalhistas da empresa inteira.'
              : (perms.includes('risk_view_sector')
                  ? `Restrito a visualizar passivos e contingências apenas do setor "${sanitizeHTML(user.sector)}".`
                  : 'Sem acesso a valores de risco e auditorias preditivas da organização.')}
          </p>
          <span style="font-size: 11.5px; font-weight: 700; color: ${perms.includes('risk_view_all') || perms.includes('risk_view_sector') ? 'var(--success)' : 'var(--danger)'};">
            ${perms.includes('risk_view_all') ? '● Painel Completo de Risco Ativo' : (perms.includes('risk_view_sector') ? '◐ Painel Filtrado por Setor' : '○ Sem Acesso')}
          </span>
        </div>

        <!-- Módulo 3: Monitor de Jornada e Ponto -->
        <div class="sim-module-box ${perms.includes('journey_monitor_all') || perms.includes('journey_monitor_team') ? '' : 'unauthorized'}">
          <span class="sim-module-badge ${perms.includes('journey_monitor_all') || perms.includes('journey_monitor_team') ? 'badge-granted' : 'badge-denied'}">
            ${perms.includes('journey_monitor_all') ? 'Todos os Colaboradores' : (perms.includes('journey_monitor_team') ? 'Apenas Equipe Direta' : 'Apenas Ponto Próprio')}
          </span>
          <h4 style="font-size: 15px; margin-bottom: 4px;">⏱️ Monitor de Jornada & Horas Extras</h4>
          <p style="font-size: 12.5px; color: var(--muted); margin-bottom: 12px;">
            ${perms.includes('journey_monitor_all')
              ? 'Alertas em tempo real de quebras de interjornada e excessos de horas de qualquer departamento.'
              : (perms.includes('journey_monitor_team')
                  ? 'Alertas em tempo real aplicados apenas aos membros subordinados à sua gestão direta.'
                  : 'Visualização apenas do seu próprio espelho de jornada/assinaturas.')}
          </p>
          <span style="font-size: 11.5px; font-weight: 700; color: ${perms.includes('journey_monitor_all') || perms.includes('journey_monitor_team') ? 'var(--success)' : 'var(--danger)'};">
            ${perms.includes('journey_adjust') ? '● Pode abonar/justificar ponto' : '○ Apenas visualização de dados'}
          </span>
        </div>

        <!-- Módulo 4: Gestão de Equipes e Hierarquias -->
        <div class="sim-module-box ${perms.includes('team_manage') ? '' : 'unauthorized'}">
          <span class="sim-module-badge ${perms.includes('team_manage') ? 'badge-granted' : 'badge-denied'}">
            ${perms.includes('team_manage') ? 'Autorizado a Gerenciar' : 'Sem Acesso'}
          </span>
          <h4 style="font-size: 15px; margin-bottom: 4px;">👥 Gestão de Equipe & Convites</h4>
          <p style="font-size: 12.5px; color: var(--muted); margin-bottom: 12px;">
            ${perms.includes('team_manage')
              ? 'Pode criar contas para subordinados, alterar permissões e configurar setores.'
              : 'Não possui autorização para criar ou modificar contas de outros colaboradores.'}
          </p>
          <span style="font-size: 11.5px; font-weight: 700; color: ${perms.includes('team_manage') ? 'var(--success)' : 'var(--danger)'};">
            ${perms.includes('team_manage') ? '● Painel de Organograma Liberado' : '○ Bloqueado por política de segurança'}
          </span>
        </div>
      </div>
    `;
  }

  return {
    renderSimulator,
    selectSimUser
  };
}

export default {
  initSimulatorModule
};
