/**
 * Leal.ai - Serviço de E-mail Transacional
 * Abstração do envio de e-mails. Para o MVP, o provedor de e-mail real (SendGrid/SES/Resend)
 * é um roadmap separado; aqui registramos em log/console e podemos plugar qualquer provider.
 */

/**
 * Envia um e-mail transacional.
 * @param {Object} param
 * @param {string} param.to
 * @param {string} param.subject
 * @param {string} param.text
 * @param {string} [param.html]
 * @returns {Promise<boolean>}
 */
export async function sendEmail({ to, subject, text, html }) {
  // TODO: Integrar provedor real (Resend/SendGrid/SES) quando configurado nas variáveis de ambiente.
  // Para desenvolvimento/MVP, registra o e-mail em log simples.
  if (process.env.EMAIL_PROVIDER && process.env.EMAIL_PROVIDER !== 'mock') {
    console.warn('[EmailService] Provedor de e-mail real não configurado, usando modo mock.');
  }

  console.log(`[EmailService] 📧 Para: ${to}`);
  console.log(`[EmailService] 📝 Assunto: ${subject}`);
  if (text) console.log(`[EmailService] 📄 Texto: ${text}`);

  // Em produção/CI, não quebrar se provider não estiver disponível
  return true;
}

export default {
  sendEmail
};
