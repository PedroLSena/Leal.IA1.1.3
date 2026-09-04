/**
 * Leal.ai - Funções Auxiliares e Helpers de Interface
 */

/**
 * Exibe notificação acessível no canto da tela (com suporte a leitor de tela)
 * @param {string} message
 * @param {'success'|'error'|'info'} [type='success']
 */
export function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'true');
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

  const icon = type === 'success' ? '✓' : (type === 'error' ? '⚠️' : 'ℹ️');
  toast.innerHTML = `<span>${icon}</span> <span>${sanitizeHTML(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideToast 0.3s cubic-bezier(0.16, 1, 0.3, 1) reverse forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3800);
}

/**
 * Sanitização básica de strings para prevenção de XSS
 * @param {string} str
 * @returns {string}
 */
export function sanitizeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Gera iniciais para o avatar a partir do nome
 * @param {string} name
 * @returns {string}
 */
export function formatAvatar(name) {
  if (!name) return 'LA';
  return name
    .trim()
    .split(/\s+/)
    .map(n => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/**
 * Exporta a lista de contas em formato JSON para download
 * @param {Array<Object>} accounts
 */
export function exportAccountsJSON(accounts) {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(accounts, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `leal_ia_contas_hierarquia_${new Date().toISOString().split('T')[0]}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast('Base de contas e hierarquias exportada com sucesso!', 'success');
}

/**
 * Copia texto para a área de transferência
 * @param {string} text
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copiado para a área de transferência!', 'info');
  } catch (err) {
    showToast('Não foi possível copiar.', 'error');
  }
}

/**
 * Cria um focus trap dentro de um elemento modal.
 * Retorna funções activate() e deactivate() para controlar o trap.
 * @param {HTMLElement} modalEl
 * @returns {{ activate: () => void, deactivate: () => void }}
 */
export function createFocusTrap(modalEl) {
  let previousFocus = null;
  let handler = null;

  function getFocusable() {
    return modalEl.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
  }

  function activate() {
    previousFocus = document.activeElement;
    handler = (e) => {
      if (e.key !== 'Tab') return;
      const focusable = getFocusable();
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    modalEl.addEventListener('keydown', handler);
    const firstInput = modalEl.querySelector('input:not([disabled]), button:not([disabled])');
    if (firstInput) firstInput.focus();
  }

  function deactivate() {
    if (handler) modalEl.removeEventListener('keydown', handler);
    if (previousFocus && previousFocus.focus) previousFocus.focus();
    previousFocus = null;
    handler = null;
  }

  return { activate, deactivate };
}
