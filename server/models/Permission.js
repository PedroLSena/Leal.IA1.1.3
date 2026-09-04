/**
 * Leal.ai - Modelo de Permissões e Matriz RBAC
 * Controle de Acesso Baseado em Cargos (Role-Based Access Control)
 * em conformidade com o Provimento da OAB e governança LGPD.
 */

import { query } from '../config/database.js';

export const PERMISSIONS_CATALOG = [
  { id: 'contracts_create', name: 'Geração de Contratos via IA', description: 'Criar minutas de contratos de trabalho (CLT, PJ, Estágio) usando o motor de IA da Leal.ai.' },
  { id: 'contracts_review', name: 'Revisão & Edição de Cláusulas', description: 'Ajustar cláusulas protetivas, alertas de risco de pejotização e anexos contratuais.' },
  { id: 'contracts_approve', name: 'Aprovação & Disparo de Assinatura', description: 'Autorizar a assinatura eletrônica com validade jurídica dos documentos gerados.' },
  { id: 'risk_view_all', name: 'Auditor Preditivo Global', description: 'Visualizar termômetro de risco trabalhista e estimativa financeira de passivos de toda a empresa.' },
  { id: 'risk_view_sector', name: 'Auditor Preditivo por Setor', description: 'Visualizar métricas e alertas de risco apenas dos colaboradores do seu respectivo departamento.' },
  { id: 'journey_monitor_all', name: 'Monitor de Jornada Corporativo', description: 'Acompanhar em tempo real violações de interjornada, excesso de horas extras e intervalos de todos.' },
  { id: 'journey_monitor_team', name: 'Monitor de Jornada da Equipe', description: 'Acompanhar a jornada apenas dos membros vinculados ao seu setor/supervisor.' },
  { id: 'journey_adjust', name: 'Abonos e Ajustes de Ponto', description: 'Aprovar justificativas, atestados e retificações no espelho de ponto.' },
  { id: 'team_manage', name: 'Gestão de Usuários & Hierarquia', description: 'Convidar novos membros, atribuir cargos, setores e revogar acessos.' },
  { id: 'billing_view', name: 'Gestão Financeira & Planos', description: 'Gerenciar assinaturas da Leal.ai (Starter, Pro, Enterprise) e faturas.' },
  { id: 'api_integration', name: 'APIs & Conexão eSocial/ERP', description: 'Configurar webhooks e sincronização com relógios de ponto e sistemas ERP.' }
];

export const TIER_PERMISSIONS = {
  'tier-1': ['contracts_create', 'contracts_review', 'contracts_approve', 'risk_view_all', 'journey_monitor_all', 'journey_adjust', 'team_manage', 'billing_view', 'api_integration'],
  'tier-2': ['contracts_create', 'contracts_review', 'contracts_approve', 'risk_view_sector', 'journey_monitor_team', 'journey_adjust', 'team_manage'],
  'tier-3': ['contracts_create', 'contracts_review', 'journey_monitor_team'],
  'tier-4': ['contracts_create'],
  'tier-5': []
};

export const HIERARCHY_DEFINITIONS = {
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

export class Permission {
  static async getAll() {
    return PERMISSIONS_CATALOG;
  }

  static getPermissionsForTier(tier) {
    return TIER_PERMISSIONS[tier] || [];
  }

  static getHierarchyDefinitions() {
    return HIERARCHY_DEFINITIONS;
  }
}

export default Permission;
