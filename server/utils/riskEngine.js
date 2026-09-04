/**
 * Leal.ai - Motor de Análise de Risco Trabalhista
 * Engine determinística baseada em regras jurídicas (CLT e legislação trabalhista)
 * que transforma as respostas de um questionário em:
 *   - findings: achados de risco com severidade
 *   - risk_score: 0-100
 *   - risk_level: low | medium | high | critical
 *   - recommendations: recomendações acionáveis
 *
 * Serve de base interpretável (explainable) para o produto de "inteligência jurídica".
 * Integração com LLM pode substituir a camada de recomendação no futuro, mantendo a base.
 */

const SEVERITY_WEIGHTS = {
  sem_risco: 0,
  baixo: 25,
  medio: 50,
  alto: 75,
  critico: 100
};

/**
 * Cada regra retorna { pontos, achado, recomendacao, severidade } quando aplicável
 * O risco por item é proporcional à probabilidade de passivo trabalhista.
 */
const RISK_RULES = {
  jornada: {
    label: 'Jornada de Trabalho',
    rules: [
      {
        id: 'jornada_extra_frequente',
        condition: a => a.jornadaExtraFrequente === 'sim',
        pontos: 15,
        severidade: 'alto',
        achado: 'Realização frequente de horas extras sem controle formal de ponto.',
        recomendacao: 'Implantar controle eletrônico de jornada e banco de horas homologado, conforme Art. 74 da CLT.'
      },
      {
        id: 'jornada_intervalo',
        condition: a => a.intervaloIntrajornada === 'nao',
        pontos: 12,
        severidade: 'alto',
        achado: 'Não há concessão do intervalo intrajornada, gerando risco de horas extras integrais.',
        recomendacao: 'Garantir intervalos de no mínimo 1h para jornadas acima de 6h (Art. 71 da CLT).'
      }
    ]
  },
  remuneracao: {
    label: 'Remuneração',
    rules: [
      {
        id: 'remun_abaixo_piso',
        condition: a => a.remuneracaoPiso === 'nao',
        pontos: 18,
        severidade: 'critico',
        achado: 'Remuneração eventualmente abaixo do piso salarial ou do salário mínimo proporcional.',
        recomendacao: 'Revisar faixas salariais para conformidade com convenções coletivas e piso da categoria.'
      },
      {
        id: 'remun_adiantamento',
        condition: a => a.adiantamentoSemComprovacao === 'sim',
        pontos: 8,
        severidade: 'medio',
        achado: 'Adiantamentos salariais concedidos sem comprovação documental formal.',
        recomendacao: 'Formalizar adiantamentos e verbas por meio de recibo e holerite.'
      }
    ]
  },
  terceirizacao: {
    label: 'Terceirização',
    rules: [
      {
        id: 'terc_atividade_fim',
        condition: a => a.terceirizacaoAtividadeFim === 'sim',
        pontos: 16,
        severidade: 'critico',
        achado: 'Terceirização de atividade-fim sem vínculo formal, risco de reconhecimento de vínculo empregatício.',
        recomendacao: 'Revisar contratos de terceirização; considerar adequação à Lei 13.429/2017 e jurisprudência do STF (Tema 725).'
      },
      {
        id: 'terc_sem_supervisao',
        condition: a => a.terceirizacaoSemSupervisao === 'sim',
        pontos: 10,
        severidade: 'alto',
        achado: 'Prestadores atuam sob subordinação direta, caracterizando fraude à terceirização.',
        recomendacao: 'Estruturar contrato e gestão para evitar subordinação e pessoalidade.'
      }
    ]
  },
  banco_horas: {
    label: 'Banco de Horas',
    rules: [
      {
        id: 'bhoras_nao_homologado',
        condition: a => a.bancoHorasHomologado === 'nao',
        pontos: 10,
        severidade: 'alto',
        achado: 'Banco de horas adotado sem acordo/negociação coletiva homologada.',
        recomendacao: 'Instituir banco de horas por convenção/acordo coletivo (Art. 59, §2º da CLT).'
      }
    ]
  },
  adicional: {
    label: 'Adicionais (Insalubridade/Periculosidade)',
    rules: [
      {
        id: 'adicional_nao_pago',
        condition: a => a.adicionalInsalubridade === 'nao',
        pontos: 12,
        severidade: 'alto',
        achado: 'Ambiente insalubre/periculoso sem pagamento do adicional devido.',
        recomendacao: 'Realizar laudo técnico (NR-15/NR-16) e pagar adicionais de 10-40% conforme exposição.'
      }
    ]
  },
  contrato: {
    label: 'Formalização Contratual',
    rules: [
      {
        id: 'contrato_sem_registro',
        condition: a => a.contratoRegistro === 'nao',
        pontos: 14,
        severidade: 'critico',
        achado: 'Trabalhadores sem registro em carteira (CTPS) formal.',
        recomendacao: 'Registrar todos os empregados na CTPS conforme Art. 29 da CLT e obrigações do eSocial.'
      }
    ]
  },
  dumping: {
    label: 'Práticas de Dumping Social',
    rules: [
      {
        id: 'dumping_menor_aprendiz',
        condition: a => a.menorAprendiz === 'nao',
        pontos: 5,
        severidade: 'medio',
        achado: 'Não cumprimento da cota de aprendizes exigida por lei.',
        recomendacao: 'Cumprir cota de aprendizagem (Art. 429 da CLT) para empresas com 7+ funcionários.'
      }
    ]
  }
};

function evaluateRules(answers) {
  const findings = [];
  let total = 0;

  for (const [groupKey, group] of Object.entries(RISK_RULES)) {
    for (const rule of group.rules) {
      if (rule.condition(answers)) {
        total += rule.pontos;
        findings.push({
          id: rule.id,
          category: group.label,
          severity: rule.severidade,
          title: rule.achado,
          recommendation: rule.recomendacao
        });
      }
    }
  }

  return { findings, total };
}

function levelFromScore(score) {
  if (score >= 60) return 'critical';
  if (score >= 40) return 'high';
  if (score >= 20) return 'medium';
  return 'low';
}

function buildSummary(answers) {
  return `Análise de ${answers.nomeTrabalhador || 'trabalhador'} para o cargo de ${answers.cargo || 'não informado'}`;
}

/**
 * Executa a análise de risco trabalhista com base nas respostas do questionário.
 * @param {Object} answers - respostas do questionário
 * @returns {{ score: number, level: string, findings: Array, recommendations: Array, summary: string }}
 */
export function analyzeLaborRisk(answers = {}) {
  const { findings, total } = evaluateRules(answers);

  // Garante pontuação máxima de 100
  const score = Math.min(100, total);
  const level = levelFromScore(score);

  const recommendations = findings.map(f => f.recommendation);

  return {
    score,
    level,
    findings,
    recommendations,
    summary: buildSummary(answers)
  };
}

/**
 * Conta as respostas válidas do questionário (para auditoria/transparência)
 */
export function countAnsweredQuestions(answers = {}) {
  const relevant = [
    'jornadaExtraFrequente', 'intervaloIntrajornada', 'remuneracaoPiso',
    'adiantamentoSemComprovacao', 'terceirizacaoAtividadeFim', 'terceirizacaoSemSupervisao',
    'bancoHorasHomologado', 'adicionalInsalubridade', 'contratoRegistro', 'menorAprendiz'
  ];
  return relevant.filter(k => answers[k] !== undefined && answers[k] !== null).length;
}

export default {
  analyzeLaborRisk,
  countAnsweredQuestions,
  RISK_RULES
};
