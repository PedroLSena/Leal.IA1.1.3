/**
 * Leal.ai - Validações de Formulários no Frontend
 */

export function cleanDigits(value) {
  if (!value) return '';
  return String(value).replace(/\D/g, '');
}

export function validateCPF(cpf) {
  const digits = cleanDigits(cpf);
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits.charAt(i), 10) * (10 - i);
  }
  let rest = 11 - (sum % 11);
  let firstDigit = rest >= 10 ? 0 : rest;
  if (firstDigit !== parseInt(digits.charAt(9), 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits.charAt(i), 10) * (11 - i);
  }
  rest = 11 - (sum % 11);
  let secondDigit = rest >= 10 ? 0 : rest;

  return secondDigit === parseInt(digits.charAt(10), 10);
}

export function validateCNPJ(cnpj) {
  const digits = cleanDigits(cnpj);
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const weightsFirst = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits.charAt(i), 10) * weightsFirst[i];
  }
  let rest = sum % 11;
  let firstDigit = rest < 2 ? 0 : 11 - rest;
  if (firstDigit !== parseInt(digits.charAt(12), 10)) return false;

  const weightsSecond = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(digits.charAt(i), 10) * weightsSecond[i];
  }
  rest = sum % 11;
  let secondDigit = rest < 2 ? 0 : 11 - rest;

  return secondDigit === parseInt(digits.charAt(13), 10);
}

export function validateCpfCnpj(value) {
  const digits = cleanDigits(value);
  if (digits.length === 11) return { isValid: validateCPF(digits), type: 'CPF' };
  if (digits.length === 14) return { isValid: validateCNPJ(digits), type: 'CNPJ' };
  return { isValid: false, type: 'UNKNOWN' };
}

export function formatCpfCnpj(value) {
  const digits = cleanDigits(value);
  if (digits.length <= 11) {
    return digits
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1-$2');
  }
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

export function validatePassword(password) {
  return typeof password === 'string' && password.length >= 6;
}
