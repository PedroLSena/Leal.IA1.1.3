/**
 * Leal.ai - Gerador de Contratos de Trabalho (CLT) com Proteção Jurídica
 * Gera minutas de contratos de trabalho com cláusulas protetivas e alertas
 * de risco (ex.: pejotização) baseados nas respostas do formulário.
 *
 * A saída é um texto de contrato em markdown/texto pleno, interpretável e auditável.
 */

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('pt-BR');
}

function currency(value) {
  if (value === undefined || value === null || value === '') return '';
  const num = Number(String(value).replace(/[^\d.-]/g, ''));
  if (isNaN(num)) return String(value);
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Cláusulas extras por tipo de jornada
 */
function jornadaClauses(jornada) {
  const j = String(jornada || '').toLowerCase();
  if (j.includes('misto') || j.includes('turno') || j.includes('revezamento')) {
    return [
      'As horas trabalhadas em turnos alternados serão compensadas conforme acordo coletivo, respeitando o adicional noturno quando aplicável (Art. 73 da CLT).',
      'Será concedido adicional de periculosidade/insalubridade quando a atividade estiver enquadrada nas NR-15 e NR-16, mediante laudo técnico.'
    ];
  }
  if (j.includes('noturno')) {
    return [
      'O trabalho noturno será remunerado com adicional de 20% (vinte por cento) sobre a hora diurna (Art. 73, §1º da CLT).',
      'A hora noturna será computada como de 52 minutos e 30 segundos (Art. 73, §1º da CLT).'
    ];
  }
  return [
    'As horas extraordinárias serão pagas com adicional de, no mínimo, 50% (cinquenta por cento), ou percentual superior previsto em convenção coletiva (Art. 59, §1º da CLT).',
    'A compensação de jornada e o banco de horas seguirão o disposto em acordo ou convenção coletiva de trabalho.'
  ];
}

/**
 * Gera o texto completo da minuta de contrato CLT.
 * @param {Object} data - dados do contrato
 * @returns {Object} { content, title, warnings }
 */
export function generateCltContract(data = {}) {
  const name = data.nomeTrabalhador || 'Trabalhador(a)';
  const empresa = data.empresa || 'Empresa';
  const cargo = data.cargo || 'Cargo a definir';
  const cnpj = data.cnpj || '';
  const cpf = data.cpf || '';
  const endereco = data.endereco || '';
  const cidade = data.cidade || '';
  const salario = currency(data.salarioBase);
  const jornada = data.jornadaSemanal || '44 horas semanais (8h/dia de segunda a sexta)';
  const termosClabe = data.clt !== undefined ? data.clt : false;

  const warnings = [];

  // Alertas de risco jurídico
  if (data.regime === 'pj') {
    warnings.push({
      tipo: 'pejotizacao',
      severidade: 'critico',
      titulo: 'Risco de Pejotização (Vínculo Empregatício)',
      descricao: 'A contratação via PJ com subordinação, pessoalidade e habitualidade pode ser desconsiderada pela Justiça do Trabalho, gerando reconhecimento de vínculo CLT retroativo.',
      recomendacao: 'Evitar pessoalidade/subordinação; estruturar contrato de prestação de serviços autônoma; recomendamos revisão pela assessoria jurídica.'
    });
  }
  if (data.salarioBase && Number(data.salarioBase) < 1412) {
    warnings.push({
      tipo: 'piso_salarial',
      severidade: 'alto',
      titulo: 'Salário abaixo do mínimo vigente',
      descricao: 'O salário informado está abaixo do salário mínimo nacional (R$ 1.412,00 em 2024).',
      recomendacao: 'Adequar a remuneração ao mínimo legal ou ao piso da categoria.'
    });
  }
  if (data.jornadaSemanal && parseInt(String(data.jornadaSemanal).replace(/\D/g, '')) > 44) {
    warnings.push({
      tipo: 'jornada_legal',
      severidade: 'alto',
      titulo: 'Jornada acima do limite legal',
      descricao: 'A jornada semanal informada excede 44 horas, limite constitucional (Art. 7º, XIII, CF/88).',
      recomendacao: 'Ajustar jornada para até 44h semanais ou prever horas extras com adicional mínimo de 50%.'
    });
  }
  if (data.menor18 === 'sim') {
    warnings.push({
      tipo: 'menor_18',
      severidade: 'medio',
      titulo: 'Aprendizagem obrigatória',
      descricao: 'Trabalhador menor de 18 anos exige observância das normas de aprendizagem e proibição de horas extras e trabalho noturno.',
      recomendacao: 'Enquadramento em contrato de aprendizagem conforme Art. 428 da CLT.'
    });
  }

  const content = `
CONTRATO DE TRABALHO POR PRAZO INDETERMINADO

CONTRATANTE: ${empresa} ${cnpj ? `- CNPJ: ${cnpj}` : ''}
CONTRATADA(O): ${name} ${cpf ? `- CPF: ${cpf}` : ''}
CARGO/FUNÇÃO: ${cargo}
LOCAL DE TRABALHO: ${endereco} ${cidade ? `- ${cidade}` : ''}
DATA DE ADMISSÃO: ${data.dataAdmissao ? formatDate(data.dataAdmissao) : '__/__/____'}
SALÁRIO BASE: ${salario}
JORNADA DE TRABALHO: ${jornada}
REGIÃO/NEGOCIAÇÃO COLETIVA: ${data.sindicato ? `Sindicato: ${data.sindicato}` : 'A definir conforme categoria'}

CLÁUSULA PRIMEIRA – DO OBJETO
O CONTRATANTE admite a CONTRATADA(O) no cargo acima descrito, de acordo com as disposições da Consolidação das Leis do Trabalho (CLT) e demais normas aplicáveis.

CLÁUSULA SEGUNDA – DA REMUNERAÇÃO
A CONTRATADA(O) fará jus ao salário mensal de ${salario}, a ser pago conforme prazos legais, sem prejuízo de outras parcelas (adicionais, gratificações, comissões) e da convenção coletiva da categoria.

CLÁUSULA TERCEIRA – DA JORNADA
A jornada de trabalho será de ${jornada}. ${jornadaClauses(jornada).join(' ')}
{termos_clabe}

CLÁUSULA QUARTA – DO PERÍODO DE EXPERIÊNCIA
Não será exigido período de experiência, salvo acordo entre as partes, limitado a 90 dias conforme Art. 445 e §1º do Art. 445-A da CLT.

CLÁUSULA QUINTA – DAS OBRIGAÇÕES DAS PARTES
A CONTRATADA(O) deverá cumprir com diligência e boa-fé as atribuições inerentes ao cargo, respeitando as normas internas, a hierarquia e os deveres de lealdade e sigilo.
O CONTRATANTE se obriga a: registrar a CTPS, recolher FGTS e contribuições previdenciárias, conceder férias e 13º salário, e zelar pela segurança e saúde no trabalho.

CLÁUSULA SEXTA – DOS ADICIONAIS E BENEFÍCIOS
Além do salário, serão observados os adicionais de insalubridade e periculosidade quando devidos, o adicional de horas extras, e os benefícios previstos em convenção coletiva ou política interna.

CLÁUSULA SÉTIMA – DAS FÉRIAS
A CONTRATADA(O) terá direito a férias anuais remuneradas acrescidas de 1/3 (um terço), conforme Art. 129 e seguintes da CLT.

CLÁUSULA OITAVA – DA RESCISÃO
A rescisão do presente contrato observará as disposições legais e os prazos de aviso prévio, com pagamento das verbas rescisórias devidas.

CLÁUSULA NONA – DO FORO
Fica eleito o foro da comarca de ${cidade || '■'} para dirimir quaisquer controvérsias oriundas deste contrato.

E, por estarem assim justas e contratadas, as partes assinam o presente em 2 (duas) vias de igual teor.

${cidade || ''}, ${formatDate(data.dataAssinatura || new Date())}

_________________________                    _________________________
CONTRATANTE                                CONTRATADA(O)
${empresa}                                 ${name}
`.replace('{termos_clabe}', termosClabe
  ? 'A justa causa e a dispensa sem justa causa observarão os procedimentos legais, incluindo o direito à aviso prévio proporcional ao tempo de serviço (Art. 7º, XXI, CF/88).'
  : '');

  return {
    title: `Contrato de Trabalho CLT - ${name} (${cargo})`,
    content,
    warnings
  };
}

/**
 * Gera minuta a partir do tipo de contrato. Hoje suporta CLT; base para CLT/PJ/Estágio.
 */
export function generateContract(data = {}) {
  const type = data.tipo || 'clt';
  if (type === 'clt') return generateCltContract(data);
  // Tipos futuros (pj, estagio) podem ser adicionados aqui
  return generateCltContract(data);
}

export default {
  generateContract,
  generateCltContract
};
