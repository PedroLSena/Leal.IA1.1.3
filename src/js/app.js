/**
 * Leal.ai - Entry Point da Aplicação Frontend
 * Orquestra chamadas à API REST, estado global reativo e inicialização dos módulos.
 */

import { accountsAPI, hierarchyAPI, TokenService } from './services/api.js';
import { showToast, exportAccountsJSON } from './utils/helpers.js';
import { initAuthModule } from './modules/auth.js';
import { initWizardModule } from './modules/wizard.js';
import { initAccountsModule } from './modules/accounts.js';
import { initOrganogramModule } from './modules/organogram.js';
import { initMatrixModule } from './modules/matrix.js';
import { initSimulatorModule } from './modules/simulator.js';
import { initRiskModule } from './modules/riskPanel.js';
import { initDashboardModule } from './modules/dashboard.js';
import { initContractsModule } from './modules/contracts.js';
import { initJourneyModule } from './modules/journey.js';
import { initBillingModule } from './modules/billing.js';

// Estado global da aplicação
export const AppState = {
  activeTab: 'wizard',
  wizardStep: 1,
  selectedCategory: 'empresa',
  selectedTier: 'tier-1',
  accounts: [],
  definitions: null,
  permissionsCatalog: [],
  selectedSimUser: null,
  filters: {
    search: '',
    category: 'all',
    tier: 'all'
  }
};

let wizardController = null;
let accountsController = null;
let organogramController = null;
let matrixController = null;
let simulatorController = null;
let riskController = null;
let dashboardController = null;
let contractsController = null;
let journeyController = null;
let billingController = null;

/**
 * Inicialização principal do sistema
 */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    initTabs();
    await loadInitialApiData();

    // Inicializa os módulos
    initAuthModule(AppState, onLoginSuccess);

    wizardController = initWizardModule(AppState, {
      onAccountCreated,
      switchTab
    });

    accountsController = initAccountsModule(AppState, {
      onAccountsUpdated: refreshData,
      onSimulateAccount: (id) => {
        simulatorController?.selectSimUser(id);
        switchTab('simulator');
      }
    });

    organogramController = initOrganogramModule(AppState, {
      onOpenAccountDetails: (id) => accountsController?.openAccountModal(id)
    });

    matrixController = initMatrixModule(AppState);
    simulatorController = initSimulatorModule(AppState);
    riskController = initRiskModule(AppState);
    dashboardController = initDashboardModule(AppState);
    contractsController = initContractsModule(AppState);
    journeyController = initJourneyModule(AppState);
    billingController = initBillingModule(AppState);

    // Renderiza telas iniciais
    accountsController.renderAccountsTable();
    organogramController.renderOrganogramTree();
    matrixController.renderPermissionsMatrix();
    simulatorController.renderSimulator();
    riskController.renderRiskPanel();
    dashboardController.renderDashboard();
    contractsController.renderContractsPanel();
    journeyController.renderJourneyPanel();
    billingController.renderBillingPanel();
    updateStatsUI();

    // Botões globais do cabeçalho
    document.getElementById('btn-export-json')?.addEventListener('click', () => {
      exportAccountsJSON(AppState.accounts);
    });

    document.getElementById('btn-reset-demo')?.addEventListener('click', async () => {
      if (confirm('Deseja recarregar as contas da API?')) {
        await refreshData();
        showToast('Dados sincronizados com o backend com sucesso!', 'success');
      }
    });

    // Roteamento via Hash da URL
    handleUrlHash();
  } catch (err) {
    console.error('Falha na inicialização da aplicação:', err);
    showToast('Conectando ao servidor... se estiver iniciando, aguarde alguns instantes.', 'info');
  }
});

/**
 * Carrega definições de hierarquia, permissões e contas do backend
 */
async function loadInitialApiData() {
  try {
    // Definições de hierarquia e permissões são públicas
    const [defs, perms] = await Promise.all([
      hierarchyAPI.getDefinitions(),
      hierarchyAPI.getPermissions()
    ]);
    AppState.definitions = defs;
    AppState.permissionsCatalog = perms;

    // Contas exigem autenticação JWT (multi-tenant); carrega apenas se houver token
    const isAuthenticated = !!TokenService.getAccessToken();
    if (isAuthenticated) {
      try {
        const accounts = await accountsAPI.getAll();
        AppState.accounts = accounts;
        if (AppState.accounts.length > 0) {
          AppState.selectedSimUser = AppState.accounts[0];
        }
      } catch (accountsErr) {
        console.warn('Falha ao carregar contas autenticadas:', accountsErr?.response?.data?.error || accountsErr);
      }
    }
  } catch (err) {
    console.warn('Backend offline ou inacessível no momento. Carregando modo de contingência.', err);
    // Definições de contingência se a API estiver indisponível no primeiro segundo
    AppState.definitions = {
      categories: {
        empresa: { name: 'Empresa / Startup / PME', icon: '🏢', tag: 'Cliente Corporativo', defaultSectors: ['Diretoria Executiva', 'Recursos Humanos & DP', 'Jurídico Interno'], roles: [{ id: 'ceo', name: 'CEO / Fundador', tier: 'tier-1', tierName: 'Nível 1 - Master Executivo' }] },
        escritorio: { name: 'Escritório de Advocacia', icon: '⚖️', tag: 'Banca Jurídica', defaultSectors: ['Societário', 'Contencioso'], roles: [{ id: 'socio_admin', name: 'Sócio Administrador', tier: 'tier-1', tierName: 'Nível 1 - Sócio' }] }
      },
      tiers: {
        'tier-1': { name: 'Nível 1 — Master / C-Level', badgeClass: 'badge-tier-1', defaultPerms: ['contracts_create', 'contracts_approve'] },
        'tier-2': { name: 'Nível 2 — Gestão / Coordenação', badgeClass: 'badge-tier-2', defaultPerms: ['contracts_create'] }
      }
    };
  }
}

/**
 * Recarrega contas e estatísticas da API
 */
async function refreshData() {
  try {
    const accounts = await accountsAPI.getAll();
    AppState.accounts = accounts;
    accountsController?.renderAccountsTable();
    organogramController?.renderOrganogramTree();
    simulatorController?.renderSimulator();
    wizardController?.populateReportsToDropdown();
    updateStatsUI();
  } catch (e) {
    console.error('Falha ao atualizar dados:', e);
  }
}

/**
 * Atualiza os contadores no topo da página
 */
async function updateStatsUI() {
  const statTotal = document.getElementById('stat-total-accounts');
  const statOrgs = document.getElementById('stat-total-orgs');
  const statLawyers = document.getElementById('stat-total-lawyers');

  try {
    const stats = await accountsAPI.getStats();
    if (statTotal) statTotal.textContent = stats.totalAccounts;
    if (statOrgs) statOrgs.textContent = stats.totalOrganizations;
    if (statLawyers) statLawyers.textContent = stats.totalLawyers;
  } catch (e) {
    if (statTotal) statTotal.textContent = AppState.accounts.length;
    const orgs = new Set(AppState.accounts.map(a => a.organization));
    if (statOrgs) statOrgs.textContent = orgs.size;
  }
}

/**
 * Callback quando uma conta é criada com sucesso no wizard
 */
async function onAccountCreated(newAccount) {
  AppState.accounts.unshift(newAccount);
  accountsController?.renderAccountsTable();
  organogramController?.renderOrganogramTree();
  simulatorController?.renderSimulator();
  wizardController?.populateReportsToDropdown();
  updateStatsUI();
}

/**
 * Callback quando login tem sucesso
 */
function onLoginSuccess(user) {
  refreshData();
}

/**
 * Controle de abas principais
 */
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
    });
  });
}

export function switchTab(tabId) {
  AppState.activeTab = tabId;

  document.querySelectorAll('.tab-btn').forEach(b => {
    const isCurrent = b.dataset.tab === tabId;
    b.classList.toggle('active', isCurrent);
    b.setAttribute('aria-selected', isCurrent ? 'true' : 'false');
  });

  document.querySelectorAll('.tab-content').forEach(c => {
    const isCurrent = c.id === `tab-${tabId}`;
    c.classList.toggle('active', isCurrent);
    c.setAttribute('aria-hidden', isCurrent ? 'false' : 'true');
  });

  if (tabId === 'accounts') {
    accountsController?.renderAccountsTable();
    organogramController?.renderOrganogramTree();
  } else if (tabId === 'matrix') {
    matrixController?.renderPermissionsMatrix();
  } else if (tabId === 'simulator') {
    simulatorController?.renderSimulator();
  } else if (tabId === 'risk') {
    riskController?.renderRiskPanel();
  } else if (tabId === 'dashboard') {
    dashboardController?.renderDashboard();
  } else if (tabId === 'contracts') {
    contractsController?.renderContractsPanel();
  } else if (tabId === 'journey') {
    journeyController?.renderJourneyPanel();
  } else if (tabId === 'billing') {
    billingController?.renderBillingPanel();
  }
}

function handleUrlHash() {
  const hash = window.location.hash;
  if (hash === '#novo') {
    switchTab('wizard');
  } else if (hash === '#organograma') {
    switchTab('accounts');
    const treeBtn = document.querySelector('.view-toggle-btn[data-view="tree"]');
    treeBtn?.click();
  } else if (hash === '#matriz') {
    switchTab('matrix');
  } else if (hash === '#simulador') {
    switchTab('simulator');
  } else if (hash === '#riscos') {
    switchTab('risk');
  } else if (hash === '#dashboard') {
    switchTab('dashboard');
  } else if (hash === '#contratos') {
    switchTab('contracts');
  } else if (hash === '#jornada') {
    switchTab('journey');
  } else if (hash === '#plano') {
    switchTab('billing');
  }
}

export default {
  AppState,
  switchTab
};
