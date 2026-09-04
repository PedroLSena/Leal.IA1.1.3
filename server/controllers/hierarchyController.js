/**
 * Leal.ai - Controller de Hierarquias & Matriz RBAC
 * Fornece metadados organizacionais, catálogo de permissões e definições de governança jurídica.
 */

import {
  PERMISSIONS_CATALOG,
  TIER_PERMISSIONS,
  HIERARCHY_DEFINITIONS
} from '../models/Permission.js';

export const TIER_DETAILS = {
  'tier-1': {
    name: 'Nível 1 — Master / C-Level / Sócio Titular',
    badgeClass: 'badge-tier-1',
    description: 'Poder deliberativo total. Gerencia a organização, convida usuários, define orçamentos, assina contratos e tem acesso irrestrito aos scores de risco trabalhista.',
    defaultPerms: TIER_PERMISSIONS['tier-1']
  },
  'tier-2': {
    name: 'Nível 2 — Gestão / Coordenação / Head',
    badgeClass: 'badge-tier-2',
    description: 'Liderança técnica de setor ou área jurídica. Aprova minutas de contratos, monitora jornadas da equipe e audita riscos trabalhistas de sua competência.',
    defaultPerms: TIER_PERMISSIONS['tier-2']
  },
  'tier-3': {
    name: 'Nível 3 — Operacional / Advogado Associado / Analista',
    badgeClass: 'badge-tier-3',
    description: 'Atuação prática do dia a dia. Gera contratos trabalhistas assistidos pela IA, realiza triagem de ponto e revisa cláusulas operacionais.',
    defaultPerms: TIER_PERMISSIONS['tier-3']
  },
  'tier-4': {
    name: 'Nível 4 — Assistencial / Estagiário / Paralegal',
    badgeClass: 'badge-tier-4',
    description: 'Apoio técnico supervisionado. Pode redigir rascunhos de contratos pela IA, mas o envio ou validação exige obrigatoriamente aprovação de um Nível 1 ou 2.',
    defaultPerms: TIER_PERMISSIONS['tier-4']
  },
  'tier-5': {
    name: 'Nível 5 — Consulta / Colaborador / Prestador PJ',
    badgeClass: 'badge-tier-5',
    description: 'Acesso self-service estritamente pessoal. Permite visualizar e assinar digitalmente seus próprios contratos e consultar o espelho da sua jornada.',
    defaultPerms: TIER_PERMISSIONS['tier-5']
  }
};

/**
 * Retorna as definições de categorias organizacionais e níveis de hierarquia
 */
export async function getHierarchyDefinitions(req, res) {
  return res.status(200).json({
    success: true,
    data: {
      categories: HIERARCHY_DEFINITIONS,
      tiers: TIER_DETAILS
    }
  });
}

/**
 * Retorna o catálogo de permissões do sistema
 */
export async function getPermissions(req, res) {
  return res.status(200).json({
    success: true,
    data: PERMISSIONS_CATALOG
  });
}

/**
 * Retorna a matriz RBAC completa (recursos mapeados por tier)
 */
export async function getRbacMatrix(req, res) {
  const tiers = Object.keys(TIER_DETAILS);
  const matrix = PERMISSIONS_CATALOG.map(perm => {
    const tierMap = {};
    for (const t of tiers) {
      tierMap[t] = TIER_PERMISSIONS[t].includes(perm.id);
    }
    return {
      permission: perm,
      access: tierMap
    };
  });

  return res.status(200).json({
    success: true,
    data: {
      tiers,
      tierDetails: TIER_DETAILS,
      matrix
    }
  });
}

export default {
  getHierarchyDefinitions,
  getPermissions,
  getRbacMatrix,
  TIER_DETAILS
};
