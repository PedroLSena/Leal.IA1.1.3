/**
 * Leal.ai - Validador Robusto de CPF e CNPJ
 * Implementação matemática completa com cálculo de dígitos verificadores (módulo 11),
 * rejeição de padrões repetidos e formatação automática em conformidade com as regras da Receita Federal.
 */

/**
 * Remove pontuações e caracteres não numéricos
 * @param {string} value
 * @returns {string}
 */
export function cleanDigits(value) {
  if (!value) return '';
  return String(value).replace(/\D/g, '');
}

/**
 * Validação rigorosa de CPF
 * @param {string} cpf
 * @returns {boolean}
 */
export function validateCPF(cpf) {
  const digits = cleanDigits(cpf);

  if (digits.length !== 11) return false;

  // Rejeita padrões conhecidos com todos os dígitos iguais (ex: 111.111.111-11)
  if (/^(\d)\1{10}$/.test(digits)) return false;

  // Cálculo do primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits.charAt(i), 10) * (10 - i);
  }
  let rest = 11 - (sum % 11);
  let firstDigit = rest >= 10 ? 0 : rest;

  if (firstDigit !== parseInt(digits.charAt(9), 10)) {
    return false;
  }

  // Cálculo do segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits.charAt(i), 10) * (11 - i);
  }
  rest = 11 - (sum % 11);
  let secondDigit = rest >= 10 ? 0 : rest;

  return secondDigit === parseInt(digits.charAt(10), 10);
}

/**
 * Validação rigorosa de CNPJ
 * @param {string} cnpj
 * @returns {boolean}
 */
export function validateCNPJ(cnpj) {
  const digits = cleanDigits(cnpj);

  if (digits.length !== 14) return false;

  // Rejeita padrões com todos os dígitos iguais
  if (/^(\d)\1{13}$/.test(digits)) return false;

  // Pesos para o 1º dígito
  const weightsFirst = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits.charAt(i), 10) * weightsFirst[i];
  }
  let rest = sum % 11;
  let firstDigit = rest < 2 ? 0 : 11 - rest;

  if (firstDigit !== parseInt(digits.charAt(12), 10)) {
    return false;
  }

  // Pesos para o 2º dígito
  const weightsSecond = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(digits.charAt(i), 10) * weightsSecond[i];
  }
  rest = sum % 11;
  let secondDigit = rest < 2 ? 0 : 11 - rest;

  return secondDigit === parseInt(digits.charAt(13), 10);
}

/**
 * Validação unificada de CPF ou CNPJ
 * @param {string} value
 * @returns {{ isValid: boolean, type: 'CPF' | 'CNPJ' | 'UNKNOWN', formatted: string }}
 */
export function validateCpfCnpj(value) {
  const digits = cleanDigits(value);

  if (digits.length === 11) {
    const isValid = validateCPF(digits);
    return {
      isValid,
      type: 'CPF',
      formatted: isValid ? formatCPF(digits) : value
    };
  }

  if (digits.length === 14) {
    const isValid = validateCNPJ(digits);
    return {
      isValid,
      type: 'CNPJ',
      formatted: isValid ? formatCNPJ(digits) : value
    };
  }

  return {
    isValid: false,
    type: 'UNKNOWN',
    formatted: value
  };
}

/**
 * Formata dígitos como CPF (000.000.000-00)
 * @param {string} cpf
 * @returns {string}
 */
export function formatCPF(cpf) {
  const digits = cleanDigits(cpf).slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

/**
 * Formata dígitos como CNPJ (00.000.000/0001-00)
 * @param {string} cnpj
 * @returns {string}
 */
export function formatCNPJ(cnpj) {
  const digits = cleanDigits(cnpj).slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

/**
 * Formata automaticamente CPF ou CNPJ baseado no comprimento dos dígitos
 * @param {string} value
 * @returns {string}
 */
export function formatCpfCnpj(value) {
  const digits = cleanDigits(value);
  if (digits.length <= 11) {
    return formatCPF(digits);
  }
  return formatCNPJ(digits);
}

export default {
  cleanDigits,
  validateCPF,
  validateCNPJ,
  validateCpfCnpj,
  formatCPF,
  formatCNPJ,
  formatCpfCnpj
};
