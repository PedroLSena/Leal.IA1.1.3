/**
 * Leal.ai - Motor de Monitor de Jornada e Ponto
 * Detecta violações trabalhistas a partir de registros de ponto:
 *   - Excesso de horas extras
 *   - Violação de interjornada (< 11h de descanso)
 *   - Falta de intervalo intrajornada
 *   - Jornada acima do limite legal (8h/dia ou 44h/semana)
 */

export const LEGAL_JORNADA_DIARIA_H = 8;
export const LEGAL_JORNADA_SEMANAL_H = 44;
export const INTERJORNADA_MIN_H = 11;
export const HORAS_EXTRAS_DIARIO_LIMITE_H = 2;

/**
 * @param {Array<{clockIn: string|null, clockOut: string|null}>} records
 * @returns {Array<Object>} violations encontradas
 */
export function detectViolations(records = []) {
  const violations = [];
  let totalExtraSemanal = 0;

  const sorted = records
    .map((r, idx) => ({ ...r, _idx: idx }))
    .sort((a, b) => new Date(a.clockIn || 0) - new Date(b.clockIn || 0));

  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i];
    if (!r.clockIn || !r.clockOut) {
      violations.push({
        index: r._idx,
        tipo: 'ponto_incompleto',
        severidade: 'medio',
        titulo: 'Registro de ponto incompleto',
        descricao: 'Registro sem entrada e/ou saída válida.',
        recomendacao: 'Regularizar o espelho de ponto.'
      });
      continue;
    }

    const inMs = new Date(r.clockIn).getTime();
    const outMs = new Date(r.clockOut).getTime();
    const workedH = (outMs - inMs) / 3600000;

    // Excesso de horas extras diárias (> 2h)
    if (workedH > LEGAL_JORNADA_DIARIA_H + HORAS_EXTRAS_DIARIO_LIMITE_H) {
      violations.push({
        index: r._idx,
        tipo: 'horas_extras_excesso',
        severidade: 'alto',
        titulo: 'Excesso de horas extras diárias',
        descricao: `Jornada de ${workedH.toFixed(1)}h no dia, superior ao limite legal + 2h extras.`,
        recomendacao: 'Reduzir a jornada e/ou formalizar banco de horas coletivo.'
      });
    }

    // Violação de interjornada (< 11h entre saída e próxima entrada)
    const next = sorted[i + 1];
    if (next && next.clockIn) {
      const intervalH = (new Date(next.clockIn).getTime() - outMs) / 3600000;
      if (intervalH > 0 && intervalH < INTERJORNADA_MIN_H) {
        violations.push({
          index: next._idx,
          tipo: 'interjornada',
          severidade: 'critico',
          titulo: 'Violação de interjornada (descanso < 11h)',
          descricao: `Intervalo entre jornadas de apenas ${intervalH.toFixed(1)}h, inferior ao mínimo legal.`,
          recomendacao: 'Garantir mínimo de 11 horas de descanso entre jornadas (Art. 66 da CLT).'
        });
      }
    }

    // Falta de intervalo intrajornada (para jornada > 6h sem pausa de 1h)
    if (workedH >= 6 && !r.intervalTaken) {
      violations.push({
        index: r._idx,
        tipo: 'intervalo_intrajornada',
        severidade: 'alto',
        titulo: 'Falta de intervalo intrajornada',
        descricao: 'Jornada acima de 6h sem concessão do intervalo de 1h.',
        recomendacao: 'Conceder intervalo de no mínimo 1h (Art. 71 da CLT).'
      });
    }

    totalExtraSemanal += Math.max(0, workedH - LEGAL_JORNADA_DIARIA_H);
  }

  // Excesso de horas extras semanais (> 10h)
  if (totalExtraSemanal > 10) {
    violations.push({
      tipo: 'horas_extras_semanal',
      severidade: 'alto',
      titulo: 'Excesso de horas extras semanais',
      descricao: `Total de ${totalExtraSemanal.toFixed(1)}h extras na semana, acima do limite de 10h.`,
      recomendacao: 'Compensar horas e respeitar o limite de 10h semanais.'
    });
  }

  // Jornada semanal > 44h
  const totalSemanalH = sorted.reduce((acc, r) => {
    if (!r.clockIn || !r.clockOut) return acc;
    return acc + (new Date(r.clockOut).getTime() - new Date(r.clockIn).getTime()) / 3600000;
  }, 0);
  if (totalSemanalH > LEGAL_JORNADA_SEMANAL_H) {
    violations.push({
      tipo: 'jornada_semanal',
      severidade: 'medio',
      titulo: 'Jornada semanal acima do limite legal',
      descricao: `Total de ${totalSemanalH.toFixed(1)}h na semana, superior à jornada legal de 44h.`,
      recomendacao: 'Ajustar a escala para não exceder 44h semanais.'
    });
  }

  return violations;
}

/**
 * Calcula horas trabalhadas e extras a partir dos registros
 * @returns {{ totalHours: number, totalOvertime: number, averagePerDay: number }}
 */
export function computeJourneyStats(records = []) {
  let totalHours = 0;
  let totalOvertime = 0;
  let days = 0;
  for (const r of records) {
    if (!r.clockIn || !r.clockOut) continue;
    const workedH = (new Date(r.clockOut).getTime() - new Date(r.clockIn).getTime()) / 3600000;
    totalHours += workedH;
    totalOvertime += Math.max(0, workedH - LEGAL_JORNADA_DIARIA_H);
    days++;
  }
  return {
    totalHours: +totalHours.toFixed(2),
    totalOvertime: +totalOvertime.toFixed(2),
    averagePerDay: days ? +(totalHours / days).toFixed(2) : 0
  };
}

export default {
  detectViolations,
  computeJourneyStats
};
