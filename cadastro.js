/**
 * Leal.ai - Gerenciador de Contas e Hierarquias Jurídicas
 * Sistema de cadastro multi-nível para Startups, Escritórios de Advocacia, Advogados e Setores.
 */

// Estado global da aplicação
const AppState = {
  activeTab: 'wizard', // 'wizard', 'accounts', 'matrix', 'simulator'
  wizardStep: 1,
  selectedCategory: 'empresa',
  selectedTier: 'tier-1',
  accounts: [],
  selectedSimUser: null,
  filters: {
    search: '',
    category: 'all',
    tier: 'all'
  }
};

// Definições de Hierarquias, Cargos e Perfis
const HIERARCHY_DEFINITIONS = {
  empresa: {
    name: 'Empresa / Startup / PME',
    icon: '🏢',
    desc: 'Empresas clientes contratantes da Leal.ai para proteger sua operação contra passivos trabalhistas.',
    tag: 'Cliente Corporativo',
    defaultSectors: ['Diretoria Executiva', 'Recursos Humanos & DP', 'Jurídico Interno / Compliance', 'Tecnologia & Produto', 'Vendas & Comercial', 'Operações'],
    roles: [
      { id: 'ceo', name: 'Diretoria Executiva / CEO / Fundador', tier: 'tier-1', tierName: 'Nível 1 - Master Executivo', desc: 'Acesso total a relatórios de passivos, faturamento, contratos corporativos e parametrização geral.' },
      { id: 'head_juridico', name: 'Head Jurídico / CLO / Compliance', tier: 'tier-2', tierName: 'Nível 2 - Gestão Jurídica', desc: 'Supervisão de conformidade legal, aprovação de minutas IA, auditoria de riscos trabalhistas.' },
      { id: 'gerente_rh', name: 'Gerente de Recursos Humanos & DP', tier: 'tier-2', tierName: 'Nível 2 - Gestão de RH', desc: 'Monitoramento de jornada diária, alertas de interjornada/horas extras e gestão admissional.' },
      { id: 'gestor_setor', name: 'Gestor de Setor / Liderança de Equipe', tier: 'tier-2', tierName: 'Nível 2 - Liderança Setorial', desc: 'Acompanhamento restrito à sua equipe (horas, escalas e solicitações).' },
      { id: 'analista_dp', name: 'Analista de DP / Operador de RH', tier: 'tier-3', tierName: 'Nível 3 - Operacional DP', desc: 'Emissão de contratos com IA, upload de marcações de ponto, gestão de benefícios.' },
      { id: 'colaborador_pj', name: 'Colaborador / Prestador PJ / CLT', tier: 'tier-5', tierName: 'Nível 5 - Portal do Colaborador', desc: 'Visualização de espelho de ponto, assinatura de contratos e canal de conformidade.' }
    ]
  },
  escritorio: {
    name: 'Escritório de Advocacia',
    icon: '⚖️',
    desc: 'Bancas de advocacia trabalhista que prestam assessoria preventiva e contenciosa aos seus clientes.',
    tag: 'Banca Jurídica',
    defaultSectors: ['Societário & Governança', 'Contencioso Trabalhista', 'Consultoria Preventiva B2B', 'Controladoria / Legal Ops', 'Secretaria Jurídica'],
    roles: [
      { id: 'socio_admin', name: 'Sócio Administrador (Managing Partner)', tier: 'tier-1', tierName: 'Nível 1 - Sócio Titular', desc: 'Gestão integral da banca, carteira de clientes, faturamento de honorários e governança.' },
      { id: 'adv_senior', name: 'Advogado Sênior / Coordenador Trabalhista', tier: 'tier-2', tierName: 'Nível 2 - Coordenador', desc: 'Revisão técnica e aprovação de contratos gerados por IA, auditoria de clientes corporativos.' },
      { id: 'adv_associado', name: 'Advogado Associado / Pleno', tier: 'tier-3', tierName: 'Nível 3 - Advogado Operacional', desc: 'Geração e customização de minutas de contratos trabalhistas, pareceres preventivos com IA.' },
      { id: 'estagiario_dir', name: 'Estagiário de Direito / Paralegal', tier: 'tier-4', tierName: 'Nível 4 - Assistencial / Estágio', desc: 'Triagem de documentos e minutas sob supervisão obrigatória de advogado sênior.' },
      { id: 'legal_ops', name: 'Controladoria Jurídica / Legal Operations', tier: 'tier-3', tierName: 'Nível 3 - Legal Ops', desc: 'Métricas de risco dos clientes, gestão de prazos e integração de dados.' }
    ]
  },
  advogado: {
    name: 'Advogado Autônomo',
    icon: '🧑‍⚖️',
    desc: 'Profissional liberal independente com OAB que assessora startups e MPEs com ferramentas de IA.',
    tag: 'Solo Practitioner',
    defaultSectors: ['Atendimento a Startups', 'Consultoria Preventiva Trabalhista', 'Elaboração Contratual'],
    roles: [
      { id: 'adv_titular', name: 'Advogado Titular Independente', tier: 'tier-1', tierName: 'Nível 1 - Titular', desc: 'Acesso integral para gerenciar carteira de clientes, minutas de IA e auditorias trabalhistas.' },
      { id: 'adv_correspondente', name: 'Correspondente / Consultor Associado', tier: 'tier-3', tierName: 'Nível 3 - Consultor', desc: 'Acesso compartilhado a contratos específicos e auditorias autorizadas.' }
    ]
  },
  contabilidade: {
    name: 'Contabilidade Parceira / BPO',
    icon: '📊',
    desc: 'Escritórios contábeis e empresas de BPO que integram folhas de pagamento e rotinas com a Leal.ai.',
    tag: 'Parceiro Contábil',
    defaultSectors: ['Folha de Pagamento & eSocial', 'Departamento Pessoal', 'Consultoria Tributária & Trabalhista'],
    roles: [
      { id: 'resp_contabil', name: 'Responsável Técnico / Sócio Contábil', tier: 'tier-1', tierName: 'Nível 1 - Master Contábil', desc: 'Gestão de múltiplas empresas clientes atendidas pelo BPO, faturamento e integrações.' },
      { id: 'analista_folha', name: 'Analista de Folha de Pagamento / DP', tier: 'tier-2', tierName: 'Nível 2 - Analista de Folha', desc: 'Validação de ponto, cálculo de passivos ocultos antes do fechamento e alertas preventivos.' }
    ]
  },
  colaborador: {
    name: 'Colaborador / Prestador Individual',
    icon: '👤',
    desc: 'Usuário final, prestador PJ ou empregado CLT para assinatura eletrônica e espelho de jornada.',
    tag: 'Usuário Final',
    defaultSectors: ['Setor Vinculado à Organização'],
    roles: [
      { id: 'prestador_pj', name: 'Prestador de Serviços (PJ)', tier: 'tier-5', tierName: 'Nível 5 - Consulta & Assinatura', desc: 'Assinatura digital de contrato de prestação de serviços, termos de confidencialidade e notas.' },
      { id: 'empregado_clt', name: 'Empregado CLT', tier: 'tier-5', tierName: 'Nível 5 - Consulta de Jornada', desc: 'Visualização de espelho de ponto, registro de solicitações e ciência de advertências/aditivos.' }
    ]
  },
  leal_admin: {
    name: 'Administração Leal.ai',
    icon: '🛡️',
    desc: 'Equipe de tecnologia, suporte jurídico e operações internas da plataforma Leal.ai.',
    tag: 'Super Admin',
    defaultSectors: ['Diretoria de Produto & IA', 'Engenharia de Software', 'Suporte Jurídico B2B', 'Compliance & Segurança'],
    roles: [
      { id: 'super_admin', name: 'Super Administrador da Plataforma', tier: 'tier-1', tierName: 'Nível 1 - Superadmin', desc: 'Acesso total ao sistema, configurações dos modelos LLM, monitor de segurança e tenants.' },
      { id: 'curador_ia', name: 'Curador de IA & Legislação Trabalhista', tier: 'tier-2', tierName: 'Nível 2 - Especialista IA', desc: 'Atualização de prompts jurídicos, jurisprudência do TST e parametrização de cláusulas.' },
      { id: 'suporte_tech', name: 'Suporte Técnico & Onboarding', tier: 'tier-3', tierName: 'Nível 3 - Operações', desc: 'Atendimento a escritórios e empresas, auxílio em integrações com ERPs e eSocial.' }
    ]
  }
};

// Descrição dos Níveis de Hierarquia (Tiers)
const TIER_DETAILS = {
  'tier-1': {
    name: 'Nível 1 — Master / C-Level / Sócio Titular',
    badgeClass: 'badge-tier-1',
    description: 'Poder deliberativo total. Gerencia a organização, convida usuários, define orçamentos, assina contratos e tem acesso irrestrito aos scores de risco trabalhista.',
    defaultPerms: ['contracts_create', 'contracts_review', 'contracts_approve', 'risk_view_all', 'journey_monitor_all', 'journey_adjust', 'team_manage', 'billing_view', 'api_integration']
  },
  'tier-2': {
    name: 'Nível 2 — Gestão / Coordenação / Head',
    badgeClass: 'badge-tier-2',
    description: 'Liderança técnica de setor ou área jurídica. Aprova minutas de contratos, monitora jornadas da equipe e audita riscos trabalhistas de sua competência.',
    defaultPerms: ['contracts_create', 'contracts_review', 'contracts_approve', 'risk_view_sector', 'journey_monitor_team', 'journey_adjust', 'team_manage']
  },
  'tier-3': {
    name: 'Nível 3 — Operacional / Advogado Associado / Analista',
    badgeClass: 'badge-tier-3',
    description: 'Atuação prática do dia a dia. Gera contratos trabalhistas assistidos pela IA, realiza triagem de ponto e revisa cláusulas operacionais.',
    defaultPerms: ['contracts_create', 'contracts_review', 'journey_monitor_team']
  },
  'tier-4': {
    name: 'Nível 4 — Assistencial / Estagiário / Paralegal',
    badgeClass: 'badge-tier-4',
    description: 'Apoio técnico supervisionado. Pode redigir rascunhos de contratos pela IA, mas o envio ou validação exige obrigatoriamente aprovação de um Nível 1 ou 2.',
    defaultPerms: ['contracts_create']
  },
  'tier-5': {
    name: 'Nível 5 — Consulta / Colaborador / Prestador PJ',
    badgeClass: 'badge-tier-5',
    description: 'Acesso self-service estritamente pessoal. Permite visualizar e assinar digitalmente seus próprios contratos e consultar o espelho da sua jornada.',
    defaultPerms: []
  }
};

// Catálogo de Permissões Granulares
const PERMISSIONS_CATALOG = [
  { id: 'contracts_create', label: 'Geração de Contratos via IA', desc: 'Criar minutas de contratos de trabalho (CLT, PJ, Estágio) usando o motor de IA da Leal.ai.' },
  { id: 'contracts_review', label: 'Revisão & Edição de Cláusulas', desc: 'Ajustar cláusulas protetivas, alertas de risco de pejotização e anexos contratuais.' },
  { id: 'contracts_approve', label: 'Aprovação & Disparo de Assinatura', desc: 'Autorizar a assinatura eletrônica com validade jurídica dos documentos gerados.' },
  { id: 'risk_view_all', label: 'Auditor Preditivo Global', desc: 'Visualizar termômetro de risco trabalhista, estimativa financeira de passivos de toda a empresa.' },
  { id: 'risk_view_sector', label: 'Auditor Preditivo por Setor', desc: 'Visualizar métricas e alertas de risco apenas dos colaboradores do seu respectivo departamento.' },
  { id: 'journey_monitor_all', label: 'Monitor de Jornada Corporativo', desc: 'Acompanhar em tempo real violações de interjornada, excesso de horas extras e intervalos de todos.' },
  { id: 'journey_monitor_team', label: 'Monitor de Jornada da Equipe', desc: 'Acompanhar a jornada apenas dos membros vinculados ao seu setor/supervisor.' },
  { id: 'journey_adjust', label: 'Abonos e Ajustes de Ponto', desc: 'Aprovar justificativas, atestados e retificações no espelho de ponto.' },
  { id: 'team_manage', label: 'Gestão de Usuários & Hierarquia', desc: 'Convidar novos membros, atribuir cargos, setores e revogar acessos.' },
  { id: 'billing_view', label: 'Gestão Financeira & Planos', desc: 'Gerenciar assinaturas da Leal.ai (Starter, Pro, Enterprise) e faturas.' },
  { id: 'api_integration', label: 'APIs & Conexão eSocial/ERP', desc: 'Configurar webhooks e sincronização com relógios de ponto e sistemas ERP.' }
];

// Dados iniciais realistas para o ecossistema da startup jurídica
const INITIAL_ACCOUNTS = [
  {
    id: 'usr-001',
    name: 'Dra. Maria Oliveira',
    email: 'dra.maria.oliveira@oliveiramedeiros.adv.br',
    category: 'escritorio',
    organization: 'Oliveira & Medeiros Sociedade de Advogados',
    cnpjCpf: '31.987.654/0001-12',
    oab: 'OAB/BA 29.845',
    sector: 'Societário & Governança',
    roleId: 'socio_admin',
    roleName: 'Sócia Administradora (Managing Partner)',
    tier: 'tier-1',
    reportsTo: 'Conselho do Escritório',
    plan: 'Enterprise',
    status: 'active',
    avatar: 'MO',
    permissions: ['contracts_create', 'contracts_review', 'contracts_approve', 'risk_view_all', 'journey_monitor_all', 'journey_adjust', 'team_manage', 'billing_view', 'api_integration'],
    createdAt: '2026-08-10'
  },
  {
    id: 'usr-002',
    name: 'Dr. Gustavo Cerqueira',
    email: 'dr.gustavo@oliveiramedeiros.adv.br',
    category: 'escritorio',
    organization: 'Oliveira & Medeiros Sociedade de Advogados',
    cnpjCpf: '712.334.890-21',
    oab: 'OAB/BA 38.102',
    sector: 'Consultoria Preventiva B2B',
    roleId: 'adv_senior',
    roleName: 'Advogado Sênior / Coordenador Trabalhista',
    tier: 'tier-2',
    reportsTo: 'Dra. Maria Oliveira',
    plan: 'Enterprise',
    status: 'active',
    avatar: 'GC',
    permissions: ['contracts_create', 'contracts_review', 'contracts_approve', 'risk_view_sector', 'journey_monitor_team', 'journey_adjust', 'team_manage'],
    createdAt: '2026-08-12'
  },
  {
    id: 'usr-003',
    name: 'Dra. Juliana Vasconcelos',
    email: 'dra.juliana@oliveiramedeiros.adv.br',
    category: 'escritorio',
    organization: 'Oliveira & Medeiros Sociedade de Advogados',
    cnpjCpf: '543.210.987-65',
    oab: 'OAB/BA 51.490',
    sector: 'Contencioso Trabalhista',
    roleId: 'adv_associado',
    roleName: 'Advogada Associada / Pleno',
    tier: 'tier-3',
    reportsTo: 'Dr. Gustavo Cerqueira',
    plan: 'Enterprise',
    status: 'active',
    avatar: 'JV',
    permissions: ['contracts_create', 'contracts_review', 'journey_monitor_team'],
    createdAt: '2026-08-15'
  },
  {
    id: 'usr-004',
    name: 'Pedro Henrique Santos',
    email: 'pedro.estagio@oliveiramedeiros.adv.br',
    category: 'escritorio',
    organization: 'Oliveira & Medeiros Sociedade de Advogados',
    cnpjCpf: '098.765.432-10',
    oab: 'Estagiário OAB/BA 12.340-E',
    sector: 'Consultoria Preventiva B2B',
    roleId: 'estagiario_dir',
    roleName: 'Estagiário de Direito / Paralegal',
    tier: 'tier-4',
    reportsTo: 'Dra. Juliana Vasconcelos',
    plan: 'Enterprise',
    status: 'active',
    avatar: 'PS',
    permissions: ['contracts_create'],
    createdAt: '2026-08-20'
  },
  {
    id: 'usr-005',
    name: 'Marcos Leal Guimarães',
    email: 'marcos@techflow.io',
    category: 'empresa',
    organization: 'TechFlow Software & Data Ltda',
    cnpjCpf: '45.123.456/0001-89',
    oab: 'Não aplicável',
    sector: 'Diretoria Executiva',
    roleId: 'ceo',
    roleName: 'Diretoria Executiva / CEO / Fundador',
    tier: 'tier-1',
    reportsTo: 'Conselho de Administração',
    plan: 'Pro',
    status: 'active',
    avatar: 'ML',
    permissions: ['contracts_create', 'contracts_review', 'contracts_approve', 'risk_view_all', 'journey_monitor_all', 'journey_adjust', 'team_manage', 'billing_view', 'api_integration'],
    createdAt: '2026-07-01'
  },
  {
    id: 'usr-006',
    name: 'Dra. Carolina Mendonça',
    email: 'carolina.legal@techflow.io',
    category: 'empresa',
    organization: 'TechFlow Software & Data Ltda',
    cnpjCpf: '321.654.987-00',
    oab: 'OAB/SP 412.981',
    sector: 'Jurídico Interno / Compliance',
    roleId: 'head_juridico',
    roleName: 'Head Jurídico / CLO / Compliance',
    tier: 'tier-2',
    reportsTo: 'Marcos Leal Guimarães',
    plan: 'Pro',
    status: 'active',
    avatar: 'CM',
    permissions: ['contracts_create', 'contracts_review', 'contracts_approve', 'risk_view_all', 'journey_monitor_team', 'journey_adjust', 'team_manage'],
    createdAt: '2026-07-05'
  },
  {
    id: 'usr-007',
    name: 'Beatriz Rezende',
    email: 'beatriz.rh@techflow.io',
    category: 'empresa',
    organization: 'TechFlow Software & Data Ltda',
    cnpjCpf: '887.654.123-45',
    oab: 'Não aplicável',
    sector: 'Recursos Humanos & DP',
    roleId: 'gerente_rh',
    roleName: 'Gerente de Recursos Humanos & DP',
    tier: 'tier-2',
    reportsTo: 'Marcos Leal Guimarães',
    plan: 'Pro',
    status: 'active',
    avatar: 'BR',
    permissions: ['contracts_create', 'contracts_review', 'risk_view_sector', 'journey_monitor_all', 'journey_adjust', 'team_manage'],
    createdAt: '2026-07-10'
  },
  {
    id: 'usr-008',
    name: 'Rodrigo Alcantara',
    email: 'rodrigo.tech@techflow.io',
    category: 'empresa',
    organization: 'TechFlow Software & Data Ltda',
    cnpjCpf: '456.789.123-01',
    oab: 'Não aplicável',
    sector: 'Tecnologia & Produto',
    roleId: 'gestor_setor',
    roleName: 'Gestor de Setor (Engenharia de Software)',
    tier: 'tier-2',
    reportsTo: 'Marcos Leal Guimarães',
    plan: 'Pro',
    status: 'active',
    avatar: 'RA',
    permissions: ['journey_monitor_team', 'risk_view_sector'],
    createdAt: '2026-07-15'
  },
  {
    id: 'usr-009',
    name: 'Lucas Pinho',
    email: 'lucas.dp@techflow.io',
    category: 'empresa',
    organization: 'TechFlow Software & Data Ltda',
    cnpjCpf: '112.233.445-56',
    oab: 'Não aplicável',
    sector: 'Recursos Humanos & DP',
    roleId: 'analista_dp',
    roleName: 'Analista de DP / Operador de RH',
    tier: 'tier-3',
    reportsTo: 'Beatriz Rezende',
    plan: 'Pro',
    status: 'active',
    avatar: 'LP',
    permissions: ['contracts_create', 'contracts_review', 'journey_monitor_team'],
    createdAt: '2026-07-20'
  },
  {
    id: 'usr-010',
    name: 'Felipe Duarte (Dev Sênior PJ)',
    email: 'felipe.consultoria@gmail.com',
    category: 'colaborador',
    organization: 'TechFlow Software & Data Ltda',
    cnpjCpf: '28.334.901/0001-55',
    oab: 'Não aplicável',
    sector: 'Tecnologia & Produto',
    roleId: 'prestador_pj',
    roleName: 'Prestador de Serviços (PJ)',
    tier: 'tier-5',
    reportsTo: 'Rodrigo Alcantara',
    plan: 'Pro',
    status: 'active',
    avatar: 'FD',
    permissions: [],
    createdAt: '2026-08-01'
  },
  {
    id: 'usr-011',
    name: 'Dr. Roberto Mendes',
    email: 'roberto@mendesadvocacia.com.br',
    category: 'advogado',
    organization: 'Mendes Advocacia Trabalhista B2B',
    cnpjCpf: '14.567.890/0001-32',
    oab: 'OAB/RJ 198.420',
    sector: 'Consultoria Preventiva Trabalhista',
    roleId: 'adv_titular',
    roleName: 'Advogado Titular Independente',
    tier: 'tier-1',
    reportsTo: 'Titular',
    plan: 'Starter',
    status: 'active',
    avatar: 'RM',
    permissions: ['contracts_create', 'contracts_review', 'contracts_approve', 'risk_view_all', 'journey_monitor_all', 'journey_adjust', 'billing_view'],
    createdAt: '2026-08-05'
  },
  {
    id: 'usr-012',
    name: 'Cláudia Fontes (Ápice Contábil)',
    email: 'claudia@apicecontabil.com.br',
    category: 'contabilidade',
    organization: 'Ápice Contabilidade & Gestão BPO',
    cnpjCpf: '22.887.112/0001-99',
    oab: 'CRC/SP 124.590',
    sector: 'Folha de Pagamento & eSocial',
    roleId: 'analista_folha',
    roleName: 'Analista de Folha de Pagamento / DP',
    tier: 'tier-2',
    reportsTo: 'Diretoria Ápice',
    plan: 'Pro',
    status: 'active',
    avatar: 'CF',
    permissions: ['contracts_create', 'contracts_review', 'risk_view_sector', 'journey_monitor_all', 'journey_adjust'],
    createdAt: '2026-08-18'
  }
];

// Inicialização do Storage e Carregamento de Dados
function initStorage() {
  const stored = localStorage.getItem('leal_hierarchy_accounts');
  if (stored) {
    try {
      AppState.accounts = JSON.parse(stored);
    } catch (e) {
      console.error('Erro ao ler localStorage. Restaurando dados padrão.', e);
      AppState.accounts = [...INITIAL_ACCOUNTS];
      saveAccounts();
    }
  } else {
    AppState.accounts = [...INITIAL_ACCOUNTS];
    saveAccounts();
  }
  AppState.selectedSimUser = AppState.accounts[0];
}

function saveAccounts() {
  localStorage.setItem('leal_hierarchy_accounts', JSON.stringify(AppState.accounts));
  updateStats();
}

function resetToDefaultAccounts() {
  if (confirm('Deseja realmente restaurar os dados de demonstração da Leal.ai? Todas as alterações personalizadas serão redefinidas.')) {
    AppState.accounts = [...INITIAL_ACCOUNTS];
    saveAccounts();
    renderAccountsTable();
    renderOrganogramTree();
    renderSimulator();
    showToast('Dados restaurados com sucesso!', 'success');
  }
}

// Inicialização da interface
document.addEventListener('DOMContentLoaded', () => {
  initStorage();
  initTabs();
  initWizard();
  initAccountsView();
  initPermissionsMatrix();
  initSimulator();
  updateStats();

  // Escuta hash da URL (ex: #novo para abrir wizard)
  if (window.location.hash === '#novo') {
    switchTab('wizard');
  } else if (window.location.hash === '#organograma') {
    switchTab('accounts');
    switchViewMode('tree');
  } else if (window.location.hash === '#matriz') {
    switchTab('matrix');
  }
});

// Navegação entre Abas Principais
function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;
      switchTab(targetTab);
    });
  });
}

function switchTab(tabId) {
  AppState.activeTab = tabId;
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tabId);
  });
  document.querySelectorAll('.tab-content').forEach(c => {
    c.classList.toggle('active', c.id === `tab-${tabId}`);
  });

  if (tabId === 'accounts') {
    renderAccountsTable();
    renderOrganogramTree();
  } else if (tabId === 'matrix') {
    renderPermissionsMatrix();
  } else if (tabId === 'simulator') {
    renderSimulator();
  }
}

// Wizard de Criação de Contas
function initWizard() {
  renderCategoryGrid();
  onCategoryChanged();
  renderTierSelectionGrid();
  populateSectorsDropdown();
  populateReportsToDropdown();
  renderPermissionsCheckboxes();
  updateLivePreview();

  // Event Listeners dos botões de passo
  document.getElementById('btn-next-step').addEventListener('click', handleNextStep);
  document.getElementById('btn-prev-step').addEventListener('click', handlePrevStep);

  // Navegação direta clicando nos números de passo
  document.querySelectorAll('.step-indicator').forEach(ind => {
    ind.addEventListener('click', () => {
      const step = parseInt(ind.dataset.step);
      if (step < AppState.wizardStep || validateStep(AppState.wizardStep)) {
        goToStep(step);
      }
    });
  });

  // Atualização em tempo real dos campos para o preview card
  const formInputs = document.querySelectorAll('#account-creation-form input, #account-creation-form select');
  formInputs.forEach(input => {
    input.addEventListener('input', updateLivePreview);
    input.addEventListener('change', updateLivePreview);
  });

  // Quando muda o cargo, ajusta automaticamente o Tier e as Permissões recomendadas
  document.getElementById('wizard-role').addEventListener('change', (e) => {
    const roleId = e.target.value;
    const catDef = HIERARCHY_DEFINITIONS[AppState.selectedCategory];
    const roleObj = catDef.roles.find(r => r.id === roleId);
    if (roleObj) {
      selectTier(roleObj.tier);
    }
    updateLivePreview();
  });

  // Listener para submissão final do formulário
  document.getElementById('account-creation-form').addEventListener('submit', handleAccountSubmit);
}

// Renderiza os Cards de Categorias (Passo 1)
function renderCategoryGrid() {
  const container = document.getElementById('category-selection-grid');
  if (!container) return;

  container.innerHTML = Object.entries(HIERARCHY_DEFINITIONS).map(([key, cat]) => `
    <div class="category-card ${AppState.selectedCategory === key ? 'selected' : ''}" data-cat="${key}">
      <div class="cat-icon">${cat.icon}</div>
      <h3>${cat.name}</h3>
      <p>${cat.desc}</p>
      <span class="cat-tag">${cat.tag}</span>
    </div>
  `).join('');

  container.querySelectorAll('.category-card').forEach(card => {
    card.addEventListener('click', () => {
      container.querySelectorAll('.category-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      AppState.selectedCategory = card.dataset.cat;
      onCategoryChanged();
    });
  });
}

function onCategoryChanged() {
  const cat = HIERARCHY_DEFINITIONS[AppState.selectedCategory];
  
  // Atualiza campo OAB: se for escritório ou advogado, destaca OAB obrigatória
  const oabGroup = document.getElementById('group-oab');
  const oabHelp = document.getElementById('oab-help-text');
  if (AppState.selectedCategory === 'escritorio' || AppState.selectedCategory === 'advogado') {
    if (oabGroup) oabGroup.style.display = 'flex';
    if (oabHelp) oabHelp.textContent = 'Inscrição profissional na OAB (Ex: OAB/SP 123.456)';
  } else {
    if (oabGroup) oabGroup.style.display = 'flex';
    if (oabHelp) oabHelp.textContent = 'Opcional para colaboradores internos com formação jurídica';
  }

  // Atualiza opções de Cargos
  const roleSelect = document.getElementById('wizard-role');
  if (roleSelect) {
    roleSelect.innerHTML = cat.roles.map(r => `
      <option value="${r.id}" data-tier="${r.tier}">${r.name} (${r.tierName})</option>
    `).join('');
    
    // Seleciona o primeiro cargo por padrão e seu tier correspondente
    if (cat.roles.length > 0) {
      selectTier(cat.roles[0].tier);
    }
  }

  // Atualiza setores recomendados
  populateSectorsDropdown();
  populateReportsToDropdown();
  updateLivePreview();
}

// Preenche o seletor de setores
function populateSectorsDropdown() {
  const select = document.getElementById('wizard-sector');
  if (!select) return;
  const cat = HIERARCHY_DEFINITIONS[AppState.selectedCategory];
  select.innerHTML = `
    ${cat.defaultSectors.map(sec => `<option value="${sec}">${sec}</option>`).join('')}
    <option value="Outro">+ Cadastrar Novo Setor...</option>
  `;

  select.addEventListener('change', () => {
    if (select.value === 'Outro') {
      const customSector = prompt('Digite o nome do novo setor/departamento:');
      if (customSector && customSector.trim() !== '') {
        const newOpt = document.createElement('option');
        newOpt.value = customSector.trim();
        newOpt.textContent = customSector.trim();
        newOpt.selected = true;
        select.insertBefore(newOpt, select.lastElementChild);
        updateLivePreview();
      } else {
        select.selectedIndex = 0;
      }
    }
  });
}

// Preenche lista de quem a conta se reporta
function populateReportsToDropdown() {
  const select = document.getElementById('wizard-reports-to');
  if (!select) return;

  const currentOrg = document.getElementById('wizard-org-name')?.value || '';
  const eligibleSupervisors = AppState.accounts.filter(a => a.tier === 'tier-1' || a.tier === 'tier-2');

  select.innerHTML = `
    <option value="Conselho / Diretoria Geral">Conselho / Diretoria Geral (Nível Máximo)</option>
    ${eligibleSupervisors.map(u => `<option value="${u.name} (${u.roleName})">${u.name} — ${u.roleName} (${u.organization})</option>`).join('')}
    <option value="Outro">Outra Chefia Imediata...</option>
  `;
}

// Renderiza Seletor de Níveis Hierárquicos (Tiers)
function renderTierSelectionGrid() {
  const container = document.getElementById('tier-selection-grid');
  if (!container) return;

  container.innerHTML = Object.entries(TIER_DETAILS).map(([tierKey, tier]) => `
    <div class="tier-card ${AppState.selectedTier === tierKey ? 'selected' : ''}" data-tier="${tierKey}">
      <div class="tier-header">
        <span class="tier-badge ${tier.badgeClass}">${tierKey.toUpperCase()}</span>
      </div>
      <strong>${tier.name}</strong>
      <p>${tier.description}</p>
    </div>
  `).join('');

  container.querySelectorAll('.tier-card').forEach(card => {
    card.addEventListener('click', () => {
      selectTier(card.dataset.tier);
    });
  });
}

function selectTier(tierKey) {
  AppState.selectedTier = tierKey;
  const container = document.getElementById('tier-selection-grid');
  if (container) {
    container.querySelectorAll('.tier-card').forEach(c => {
      c.classList.toggle('selected', c.dataset.tier === tierKey);
    });
  }

  // Marca permissões padrão do Tier
  const tierDef = TIER_DETAILS[tierKey];
  if (tierDef) {
    document.querySelectorAll('.perm-checkbox').forEach(cb => {
      cb.checked = tierDef.defaultPerms.includes(cb.value);
    });
  }
  updateLivePreview();
}

// Renderiza Caixas de Permissões Granulares
function renderPermissionsCheckboxes() {
  const container = document.getElementById('perm-matrix-grid');
  if (!container) return;

  const currentTier = TIER_DETAILS[AppState.selectedTier];
  const defaults = currentTier ? currentTier.defaultPerms : [];

  container.innerHTML = PERMISSIONS_CATALOG.map(perm => `
    <label class="perm-box">
      <input type="checkbox" class="perm-checkbox" value="${perm.id}" ${defaults.includes(perm.id) ? 'checked' : ''} />
      <div class="perm-info">
        <div class="perm-title">${perm.label}</div>
        <div class="perm-desc">${perm.desc}</div>
      </div>
    </label>
  `).join('');

  container.querySelectorAll('.perm-checkbox').forEach(cb => {
    cb.addEventListener('change', updateLivePreview);
  });
}

// Navegação entre passos do Wizard
function handleNextStep() {
  if (!validateStep(AppState.wizardStep)) return;
  if (AppState.wizardStep < 4) {
    goToStep(AppState.wizardStep + 1);
  } else {
    // Submeter formulário no último passo
    document.getElementById('account-creation-form').dispatchEvent(new Event('submit'));
  }
}

function handlePrevStep() {
  if (AppState.wizardStep > 1) {
    goToStep(AppState.wizardStep - 1);
  }
}

function goToStep(step) {
  AppState.wizardStep = step;

  // Atualiza indicadores no topo
  document.querySelectorAll('.step-indicator').forEach(ind => {
    const s = parseInt(ind.dataset.step);
    ind.classList.toggle('active', s === step);
    ind.classList.toggle('completed', s < step);
  });

  // Exibe o passo correspondente
  document.querySelectorAll('.wizard-step').forEach(ws => {
    ws.classList.toggle('active', parseInt(ws.dataset.step) === step);
  });

  // Atualiza botões de ação
  const btnPrev = document.getElementById('btn-prev-step');
  const btnNext = document.getElementById('btn-next-step');

  if (btnPrev) btnPrev.style.visibility = step === 1 ? 'hidden' : 'visible';
  if (btnNext) {
    if (step === 4) {
      btnNext.innerHTML = 'Concluir e Criar Conta <span>✓</span>';
      btnNext.className = 'btn-primary';
      btnNext.style.background = 'var(--green-dark)';
    } else {
      btnNext.innerHTML = 'Próximo Passo <span>→</span>';
      btnNext.className = 'btn-primary';
      btnNext.style.background = 'var(--ink)';
    }
  }

  updateLivePreview();
}

// Validação dos passos
function validateStep(step) {
  if (step === 1) {
    if (!AppState.selectedCategory) {
      showToast('Selecione uma categoria de organização para prosseguir.', 'error');
      return false;
    }
    return true;
  }

  if (step === 2) {
    const orgName = document.getElementById('wizard-org-name')?.value.trim();
    const cnpjCpf = document.getElementById('wizard-cnpj-cpf')?.value.trim();
    const role = document.getElementById('wizard-role')?.value;

    if (!orgName) {
      showToast('Informe o Nome da Empresa ou Escritório.', 'error');
      document.getElementById('wizard-org-name')?.focus();
      return false;
    }
    if (!cnpjCpf) {
      showToast('Informe o CNPJ ou CPF para conformidade jurídica.', 'error');
      document.getElementById('wizard-cnpj-cpf')?.focus();
      return false;
    }
    return true;
  }

  if (step === 3) {
    const fullName = document.getElementById('wizard-full-name')?.value.trim();
    const email = document.getElementById('wizard-email')?.value.trim();
    const password = document.getElementById('wizard-password')?.value;

    if (!fullName) {
      showToast('Informe o Nome Completo do Usuário Titular.', 'error');
      document.getElementById('wizard-full-name')?.focus();
      return false;
    }
    if (!email || !email.includes('@')) {
      showToast('Informe um e-mail corporativo válido.', 'error');
      document.getElementById('wizard-email')?.focus();
      return false;
    }
    if (!password || password.length < 6) {
      showToast('Defina uma senha provisória de no mínimo 6 dígitos.', 'error');
      document.getElementById('wizard-password')?.focus();
      return false;
    }
    return true;
  }

  if (step === 4) {
    const lgpdConsent = document.getElementById('wizard-lgpd-consent');
    if (lgpdConsent && !lgpdConsent.checked) {
      showToast('É necessário aceitar os Termos de Sigilo, Governança e LGPD da Leal.ai.', 'error');
      return false;
    }
    return true;
  }

  return true;
}

// Atualização Dinâmica do Crachá / Cartão de Visualização em Tempo Real (Preview)
function updateLivePreview() {
  const previewName = document.getElementById('preview-name');
  const previewOrg = document.getElementById('preview-org');
  const previewRole = document.getElementById('preview-role');
  const previewSector = document.getElementById('preview-sector');
  const previewTierPill = document.getElementById('preview-tier-pill');
  const previewAvatar = document.getElementById('preview-avatar');
  const previewPlan = document.getElementById('preview-plan');

  const fullName = document.getElementById('wizard-full-name')?.value.trim() || 'Nome do Usuário';
  const orgName = document.getElementById('wizard-org-name')?.value.trim() || 'Organização Jurídica';
  const sector = document.getElementById('wizard-sector')?.value || 'Setor Jurídico / RH';
  const roleSelect = document.getElementById('wizard-role');
  const roleText = roleSelect && roleSelect.options[roleSelect.selectedIndex] ? roleSelect.options[roleSelect.selectedIndex].text.split('(')[0].trim() : 'Cargo a Definir';
  const plan = document.getElementById('wizard-plan')?.value || 'Pro';

  if (previewName) previewName.textContent = fullName;
  if (previewOrg) previewOrg.textContent = orgName;
  if (previewRole) previewRole.textContent = roleText;
  if (previewSector) previewSector.textContent = sector;
  if (previewPlan) previewPlan.textContent = plan;

  // Iniciais para o avatar
  const initials = fullName.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'LA';
  if (previewAvatar) previewAvatar.textContent = initials;

  // Atualiza Pill do Tier
  if (previewTierPill) {
    const tier = TIER_DETAILS[AppState.selectedTier];
    previewTierPill.textContent = AppState.selectedTier.toUpperCase();
    previewTierPill.className = `hierarchy-level-pill ${tier?.badgeClass || ''}`;
  }

  // Atualiza lista de recursos autorizados no sidebar preview
  const activePerms = Array.from(document.querySelectorAll('.perm-checkbox:checked')).map(cb => cb.value);
  const featureList = document.getElementById('preview-features-list');
  if (featureList) {
    featureList.innerHTML = `
      <li class="${activePerms.includes('contracts_create') ? 'enabled' : 'disabled'}">
        <i>${activePerms.includes('contracts_create') ? '✓' : '✗'}</i> Geração de Contratos Trabalhistas com IA
      </li>
      <li class="${activePerms.includes('contracts_approve') ? 'enabled' : 'disabled'}">
        <i>${activePerms.includes('contracts_approve') ? '✓' : '✗'}</i> Aprovação de Minutas & Assinatura Digital
      </li>
      <li class="${activePerms.includes('risk_view_all') || activePerms.includes('risk_view_sector') ? 'enabled' : 'disabled'}">
        <i>${activePerms.includes('risk_view_all') || activePerms.includes('risk_view_sector') ? '✓' : '✗'}</i> Auditor Preditivo de Passivos
      </li>
      <li class="${activePerms.includes('journey_monitor_all') || activePerms.includes('journey_monitor_team') ? 'enabled' : 'disabled'}">
        <i>${activePerms.includes('journey_monitor_all') || activePerms.includes('journey_monitor_team') ? '✓' : '✗'}</i> Monitor de Jornada e Ponto
      </li>
      <li class="${activePerms.includes('team_manage') ? 'enabled' : 'disabled'}">
        <i>${activePerms.includes('team_manage') ? '✓' : '✗'}</i> Gestão de Hierarquia e Usuários
      </li>
    `;
  }
}

// Submissão do Formulário de Criação de Conta
function handleAccountSubmit(e) {
  e.preventDefault();
  if (!validateStep(1) || !validateStep(2) || !validateStep(3) || !validateStep(4)) return;

  const roleSelect = document.getElementById('wizard-role');
  const roleId = roleSelect ? roleSelect.value : 'padrao';
  const roleText = roleSelect && roleSelect.options[roleSelect.selectedIndex] ? roleSelect.options[roleSelect.selectedIndex].text.split('(')[0].trim() : 'Colaborador';

  const fullName = document.getElementById('wizard-full-name').value.trim();
  const email = document.getElementById('wizard-email').value.trim();
  const orgName = document.getElementById('wizard-org-name').value.trim();
  const cnpjCpf = document.getElementById('wizard-cnpj-cpf').value.trim();
  const oab = document.getElementById('wizard-oab')?.value.trim() || 'Não informada';
  const sector = document.getElementById('wizard-sector').value;
  const reportsTo = document.getElementById('wizard-reports-to').value;
  const plan = document.getElementById('wizard-plan').value;

  const selectedPerms = Array.from(document.querySelectorAll('.perm-checkbox:checked')).map(cb => cb.value);

  const newAccount = {
    id: 'usr-' + String(AppState.accounts.length + 1).padStart(3, '0') + '-' + Math.floor(Math.random() * 1000),
    name: fullName,
    email: email,
    category: AppState.selectedCategory,
    organization: orgName,
    cnpjCpf: cnpjCpf,
    oab: oab,
    sector: sector,
    roleId: roleId,
    roleName: roleText,
    tier: AppState.selectedTier,
    reportsTo: reportsTo,
    plan: plan,
    status: 'active',
    avatar: fullName.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase(),
    permissions: selectedPerms,
    createdAt: new Date().toISOString().split('T')[0]
  };

  AppState.accounts.unshift(newAccount);
  saveAccounts();

  showToast(`Conta criada com sucesso para ${fullName} com perfil ${TIER_DETAILS[newAccount.tier].name}!`, 'success');

  // Limpa o formulário e retorna para a lista
  document.getElementById('account-creation-form').reset();
  goToStep(1);
  switchTab('accounts');
}

// Aba de Gestão de Contas & Organograma (Tab 2)
function initAccountsView() {
  const searchInput = document.getElementById('filter-search');
  const catFilter = document.getElementById('filter-category');
  const tierFilter = document.getElementById('filter-tier');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      AppState.filters.search = e.target.value.toLowerCase();
      renderAccountsTable();
    });
  }

  if (catFilter) {
    catFilter.addEventListener('change', (e) => {
      AppState.filters.category = e.target.value;
      renderAccountsTable();
    });
  }

  if (tierFilter) {
    tierFilter.addEventListener('change', (e) => {
      AppState.filters.tier = e.target.value;
      renderAccountsTable();
    });
  }

  // Alternar entre Visualização em Tabela ou Organograma
  document.querySelectorAll('.view-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchViewMode(btn.dataset.view);
    });
  });
}

function switchViewMode(mode) {
  document.querySelectorAll('.view-toggle-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.view === mode);
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
    const matchesSearch = !AppState.filters.search || 
      acc.name.toLowerCase().includes(AppState.filters.search) ||
      acc.email.toLowerCase().includes(AppState.filters.search) ||
      acc.organization.toLowerCase().includes(AppState.filters.search) ||
      acc.sector.toLowerCase().includes(AppState.filters.search) ||
      acc.roleName.toLowerCase().includes(AppState.filters.search);

    const matchesCat = AppState.filters.category === 'all' || acc.category === AppState.filters.category;
    const matchesTier = AppState.filters.tier === 'all' || acc.tier === AppState.filters.tier;

    return matchesSearch && matchesCat && matchesTier;
  });

  if (filtered.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 48px 20px; color: var(--muted);">
          Nenhuma conta encontrada para os filtros selecionados.
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = filtered.map(acc => {
    const tierDef = TIER_DETAILS[acc.tier] || { name: acc.tier, badgeClass: '' };
    const catDef = HIERARCHY_DEFINITIONS[acc.category] || { icon: '💼', name: acc.category };

    return `
      <tr>
        <td>
          <div class="user-cell">
            <div class="user-avatar-cell">${acc.avatar || 'LA'}</div>
            <div class="user-info-text">
              <strong>${acc.name}</strong>
              <span>${acc.email}</span>
            </div>
          </div>
        </td>
        <td>
          <strong>${acc.organization}</strong>
          <span style="display:block; font-size:11.5px; color:var(--muted);">${catDef.icon} ${catDef.name}</span>
        </td>
        <td>
          <strong>${acc.roleName}</strong>
          <span style="display:block; font-size:11.5px; color:var(--muted);">${acc.sector}</span>
        </td>
        <td>
          <span class="badge-hierarchy ${tierDef.badgeClass}">
            ${acc.tier.toUpperCase()} — ${tierDef.name.split('—')[1] || tierDef.name}
          </span>
        </td>
        <td>
          <span style="font-size:12px; color:var(--ink);">${acc.reportsTo || '—'}</span>
        </td>
        <td>
          <span class="status-badge ${acc.status === 'active' ? 'status-active' : 'status-disabled'}">
            ${acc.status === 'active' ? '● Ativo' : '○ Inativo'}
          </span>
        </td>
        <td>
          <div class="action-buttons-group">
            <button class="btn-icon" title="Ver Detalhes & Permissões" onclick="openAccountModal('${acc.id}')">👁</button>
            <button class="btn-icon" title="Simular Acesso na Plataforma" onclick="simulateAccount('${acc.id}')">🚀</button>
            <button class="btn-icon" title="Alternar Status Ativo/Inativo" onclick="toggleAccountStatus('${acc.id}')">🔄</button>
            <button class="btn-icon" title="Remover Conta" onclick="deleteAccount('${acc.id}')" style="color:var(--danger)">🗑</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Renderiza o Organograma Visual em Árvore Hierárquica
function renderOrganogramTree() {
  const container = document.getElementById('org-tree-content');
  if (!container) return;

  // Agrupa contas por Organização
  const orgMap = {};
  AppState.accounts.forEach(acc => {
    if (!orgMap[acc.organization]) {
      orgMap[acc.organization] = {
        name: acc.organization,
        category: acc.category,
        members: []
      };
    }
    orgMap[acc.organization].members.push(acc);
  });

  container.innerHTML = Object.values(orgMap).map(org => {
    const catDef = HIERARCHY_DEFINITIONS[org.category] || { icon: '🏢', name: 'Organização' };
    
    // Separa por Tiers para montar a hierarquia visual
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
            <strong style="font-size: 16px; font-family:'Plus Jakarta Sans', sans-serif;">${org.name}</strong>
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
}

function renderTreeNodeItem(user) {
  const tierDef = TIER_DETAILS[user.tier] || { badgeClass: '' };
  return `
    <div class="tree-node" onclick="openAccountModal('${user.id}')" style="cursor: pointer;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <div class="user-avatar-cell" style="width: 32px; height: 32px; font-size: 11px;">${user.avatar || 'LA'}</div>
        <div>
          <strong style="font-size: 13.5px; color: var(--ink);">${user.name}</strong>
          <span style="display: block; font-size: 11.5px; color: var(--muted);">${user.roleName} • ${user.sector}</span>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <span class="badge-hierarchy ${tierDef.badgeClass}" style="font-size: 10px;">${user.tier.toUpperCase()}</span>
        ${user.oab && user.oab !== 'Não aplicável' && user.oab !== 'Não informada' ? `<span style="font-size: 11px; font-weight: 600; color: var(--green-dark); background: var(--green-light); padding: 2px 6px; border-radius: 4px;">⚖️ ${user.oab}</span>` : ''}
      </div>
    </div>
  `;
}

// Alternar Status da Conta
function toggleAccountStatus(id) {
  const acc = AppState.accounts.find(a => a.id === id);
  if (acc) {
    acc.status = acc.status === 'active' ? 'disabled' : 'active';
    saveAccounts();
    renderAccountsTable();
    showToast(`Status da conta de ${acc.name} alterado para ${acc.status === 'active' ? 'Ativo' : 'Inativo'}.`, 'success');
  }
}

// Excluir Conta
function deleteAccount(id) {
  const acc = AppState.accounts.find(a => a.id === id);
  if (!acc) return;
  if (confirm(`Tem certeza que deseja excluir a conta de ${acc.name} (${acc.roleName})?`)) {
    AppState.accounts = AppState.accounts.filter(a => a.id !== id);
    saveAccounts();
    renderAccountsTable();
    renderOrganogramTree();
    showToast(`Conta de ${acc.name} removida.`, 'success');
  }
}

// Modal de Detalhes da Conta
function openAccountModal(id) {
  const acc = AppState.accounts.find(a => a.id === id);
  if (!acc) return;

  const modal = document.getElementById('account-details-modal');
  const body = document.getElementById('modal-account-content');
  if (!modal || !body) return;

  const tierDef = TIER_DETAILS[acc.tier] || { name: acc.tier, description: '' };
  const catDef = HIERARCHY_DEFINITIONS[acc.category] || { icon: '💼', name: acc.category };

  body.innerHTML = `
    <div style="display: flex; gap: 16px; align-items: center; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid var(--line-light);">
      <div class="id-avatar" style="width: 56px; height: 56px; font-size: 20px;">${acc.avatar}</div>
      <div>
        <h2 style="font-family:'Plus Jakarta Sans'; font-size: 20px; color: var(--ink);">${acc.name}</h2>
        <span style="color: var(--muted); font-size: 13.5px;">${acc.email}</span>
        <div style="margin-top: 6px; display: flex; gap: 8px;">
          <span class="badge-hierarchy ${tierDef.badgeClass}">${acc.tier.toUpperCase()} — ${tierDef.name.split('—')[1] || tierDef.name}</span>
          <span class="status-badge ${acc.status === 'active' ? 'status-active' : 'status-disabled'}">${acc.status === 'active' ? '● Ativo' : '○ Inativo'}</span>
        </div>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px;">
      <div style="background: var(--cream-card); padding: 12px 16px; border-radius: 8px;">
        <span style="font-size: 11.5px; color: var(--muted); font-weight: 600; text-transform: uppercase;">Organização</span>
        <strong style="display: block; font-size: 14px; margin-top: 2px;">${acc.organization}</strong>
        <span style="font-size: 12px; color: var(--muted);">${catDef.icon} ${catDef.name}</span>
      </div>

      <div style="background: var(--cream-card); padding: 12px 16px; border-radius: 8px;">
        <span style="font-size: 11.5px; color: var(--muted); font-weight: 600; text-transform: uppercase;">Setor & Cargo</span>
        <strong style="display: block; font-size: 14px; margin-top: 2px;">${acc.roleName}</strong>
        <span style="font-size: 12px; color: var(--muted);">${acc.sector}</span>
      </div>

      <div style="background: var(--cream-card); padding: 12px 16px; border-radius: 8px;">
        <span style="font-size: 11.5px; color: var(--muted); font-weight: 600; text-transform: uppercase;">CNPJ / CPF</span>
        <strong style="display: block; font-size: 14px; margin-top: 2px;">${acc.cnpjCpf}</strong>
      </div>

      <div style="background: var(--cream-card); padding: 12px 16px; border-radius: 8px;">
        <span style="font-size: 11.5px; color: var(--muted); font-weight: 600; text-transform: uppercase;">Inscrição OAB</span>
        <strong style="display: block; font-size: 14px; margin-top: 2px;">${acc.oab || 'Não informada'}</strong>
      </div>

      <div style="background: var(--cream-card); padding: 12px 16px; border-radius: 8px;">
        <span style="font-size: 11.5px; color: var(--muted); font-weight: 600; text-transform: uppercase;">Subordinação (Reporta a)</span>
        <strong style="display: block; font-size: 14px; margin-top: 2px;">${acc.reportsTo || 'Conselho'}</strong>
      </div>

      <div style="background: var(--cream-card); padding: 12px 16px; border-radius: 8px;">
        <span style="font-size: 11.5px; color: var(--muted); font-weight: 600; text-transform: uppercase;">Plano Vinculado</span>
        <strong style="display: block; font-size: 14px; margin-top: 2px;">Leal.ai ${acc.plan || 'Pro'}</strong>
      </div>
    </div>

    <div>
      <h4 style="font-family:'Plus Jakarta Sans'; font-size: 15px; margin-bottom: 12px; color: var(--ink);">Permissões Ativas na Plataforma</h4>
      <div style="display: flex; flex-wrap: wrap; gap: 8px;">
        ${PERMISSIONS_CATALOG.map(perm => {
          const isAllowed = acc.permissions.includes(perm.id);
          return `
            <span style="font-size: 12px; padding: 6px 12px; border-radius: 6px; border: 1px solid ${isAllowed ? 'var(--green)' : 'var(--line-light)'}; background: ${isAllowed ? 'var(--green-light)' : '#f8fafc'}; color: ${isAllowed ? 'var(--green-dark)' : 'var(--muted)'}; font-weight: 600;">
              ${isAllowed ? '✓' : '✗'} ${perm.label}
            </span>
          `;
        }).join('')}
      </div>
    </div>

    <div style="margin-top: 28px; display: flex; justify-content: flex-end; gap: 12px;">
      <button class="btn-secondary" onclick="closeAccountModal()">Fechar</button>
      <button class="btn-primary" onclick="closeAccountModal(); simulateAccount('${acc.id}');">Simular Visão deste Perfil ↗</button>
    </div>
  `;

  modal.classList.add('active');
}

function closeAccountModal() {
  document.getElementById('account-details-modal')?.classList.remove('active');
}

// Matriz de Permissões (Tab 3)
function initPermissionsMatrix() {
  renderPermissionsMatrix();
}

function renderPermissionsMatrix() {
  const container = document.getElementById('matrix-table-container');
  if (!container) return;

  const tiers = ['tier-1', 'tier-2', 'tier-3', 'tier-4', 'tier-5'];

  container.innerHTML = `
    <table class="matrix-table">
      <thead>
        <tr>
          <th>Módulo / Recurso do Sistema</th>
          ${tiers.map(t => `<th>${t.toUpperCase()}<br><small style="font-weight:normal; opacity:0.85;">${TIER_DETAILS[t].name.split('—')[1] || ''}</small></th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${PERMISSIONS_CATALOG.map(perm => `
          <tr>
            <td>
              <strong>${perm.label}</strong>
              <div style="font-size:11.5px; color:var(--muted); margin-top:2px;">${perm.desc}</div>
            </td>
            ${tiers.map(t => {
              const hasPerm = TIER_DETAILS[t].defaultPerms.includes(perm.id);
              return `
                <td>
                  ${hasPerm ? '<span class="perm-check-yes">✓</span>' : '<span class="perm-check-no">—</span>'}
                </td>
              `;
            }).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// Simulador de Perfil de Usuário (Tab 4)
function initSimulator() {
  renderSimulator();
}

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
    <div class="sim-user-item ${AppState.selectedSimUser?.id === u.id ? 'selected' : ''}" onclick="selectSimUser('${u.id}')">
      <div class="user-avatar-cell" style="width: 34px; height: 34px; font-size: 12px;">${u.avatar || 'LA'}</div>
      <div style="flex: 1; overflow: hidden;">
        <strong style="display: block; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${u.name}</strong>
        <span style="font-size: 11.5px; color: var(--muted);">${u.roleName}</span>
      </div>
      <span class="badge-hierarchy ${TIER_DETAILS[u.tier]?.badgeClass}" style="font-size: 9.5px;">${u.tier.toUpperCase()}</span>
    </div>
  `).join('');
}

function selectSimUser(id) {
  AppState.selectedSimUser = AppState.accounts.find(a => a.id === id);
  renderSimulatorUserPicker();
  renderSimulatorScreen();
}

function simulateAccount(id) {
  AppState.selectedSimUser = AppState.accounts.find(a => a.id === id);
  switchTab('simulator');
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
  const tierDef = TIER_DETAILS[user.tier] || { name: user.tier };

  container.innerHTML = `
    <div class="sim-header-view">
      <div>
        <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.8;">Modo Simulação de Sessão Ativa</span>
        <h2 style="font-family:'Plus Jakarta Sans'; font-size: 20px; margin-top: 4px;">Visão de: ${user.name}</h2>
        <span style="font-size: 13px; opacity: 0.9;">${user.organization} • ${user.roleName} (${tierDef.name})</span>
      </div>
      <div style="text-align: right;">
        <span class="badge-hierarchy ${tierDef.badgeClass}" style="background: white; color: var(--ink); font-size: 12px;">
          ${user.tier.toUpperCase()}
        </span>
      </div>
    </div>

    <div style="margin-bottom: 24px;">
      <h3 style="font-family:'Plus Jakarta Sans'; font-size: 16px; margin-bottom: 6px;">O que este usuário enxerga ao acessar a Leal.ai:</h3>
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
                ? 'Pode gerar minutas, alterar cláusulas e aprovar contratos para assinatura.' 
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
                ? `Restrito a visualizar passivos e contingências apenas do setor "${user.sector}".` 
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

// Estatísticas Rápidas do Topo
function updateStats() {
  const statTotal = document.getElementById('stat-total-accounts');
  const statOrgs = document.getElementById('stat-total-orgs');
  const statLawyers = document.getElementById('stat-total-lawyers');

  if (statTotal) statTotal.textContent = AppState.accounts.length;
  
  const orgs = new Set(AppState.accounts.map(a => a.organization));
  if (statOrgs) statOrgs.textContent = orgs.size;

  const lawyers = AppState.accounts.filter(a => a.category === 'escritorio' || a.category === 'advogado' || (a.oab && a.oab.includes('OAB')));
  if (statLawyers) statLawyers.textContent = lawyers.length;
}

// Exportar Dados como JSON
function exportAccountsJSON() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(AppState.accounts, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `leal_ia_contas_hierarquia_${new Date().toISOString().split('T')[0]}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast('Base de contas e hierarquias exportada com sucesso!', 'success');
}

// Toast Helper
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✓' : '⚠️'}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideToast 0.3s ease reverse forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
