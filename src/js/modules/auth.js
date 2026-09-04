/**
 * Leal.ai - Módulo de Autenticação do Frontend
 * Gerencia o modal de login, estado de sessão do usuário logado e cabeçalho interativo.
 */

import { authAPI, TokenService } from '../services/api.js';
import { showToast, createFocusTrap } from '../utils/helpers.js';

export function initAuthModule(appState, onLoginSuccess) {
  const loginModal = document.getElementById('login-modal');
  const loginForm = document.getElementById('login-form');
  const signupModal = document.getElementById('signup-modal');
  const signupForm = document.getElementById('signup-form');
  const btnOpenLogin = document.getElementById('btn-open-login');
  const btnOpenSignup = document.getElementById('btn-open-signup');
  const btnCloseLogin = document.getElementById('btn-close-login');
  const btnCloseSignup = document.getElementById('btn-close-signup');
  const btnLoginToSignup = document.getElementById('btn-login-to-signup');
  const btnSignupToLogin = document.getElementById('btn-signup-to-login');
  const userSessionBadge = document.getElementById('user-session-badge');

  // Atualiza exibição do usuário na barra superior se já estiver logado
  updateSessionUI();

  if (btnOpenLogin) {
    btnOpenLogin.addEventListener('click', () => {
      openLoginModal();
    });
  }

  if (btnCloseLogin) {
    btnCloseLogin.addEventListener('click', () => {
      closeLoginModal();
    });
  }

  btnOpenSignup?.addEventListener('click', openSignupModal);
  btnCloseSignup?.addEventListener('click', closeSignupModal);
  btnLoginToSignup?.addEventListener('click', () => {
    closeLoginModal();
    openSignupModal();
  });
  btnSignupToLogin?.addEventListener('click', () => {
    closeSignupModal();
    openLoginModal();
  });

  // Fechar modal ao pressionar ESC
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (loginModal?.classList.contains('active')) closeLoginModal();
    if (signupModal?.classList.contains('active')) closeSignupModal();
  });

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const emailInput = document.getElementById('login-email');
      const passwordInput = document.getElementById('login-password');
      const btnSubmit = document.getElementById('btn-login-submit');

      const email = emailInput?.value.trim();
      const password = passwordInput?.value;

      if (!email || !password) {
        showToast('Preencha seu e-mail e senha corporativos.', 'error');
        return;
      }

      try {
        if (btnSubmit) {
          btnSubmit.disabled = true;
          btnSubmit.textContent = 'Autenticando...';
        }

        const res = await authAPI.login(email, password);
        showToast(`Bem-vindo(a), ${res.user.name}! Sessão autenticada.`, 'success');
        closeLoginModal();
        updateSessionUI();

        if (onLoginSuccess) {
          onLoginSuccess(res.user);
        }
      } catch (err) {
        const errorMsg = err.response?.data?.error || 'Falha ao autenticar credenciais.';
        showToast(errorMsg, 'error');
      } finally {
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.textContent = 'Entrar na Plataforma';
        }
      }
    });
  }

  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitButton = document.getElementById('btn-signup-submit');
      const password = document.getElementById('signup-password')?.value || '';
      const confirmation = document.getElementById('signup-password-confirm')?.value || '';

      if (password !== confirmation) {
        showToast('As senhas informadas não coincidem.', 'error');
        return;
      }

      const payload = {
        name: document.getElementById('signup-name')?.value.trim(),
        email: document.getElementById('signup-email')?.value.trim(),
        password,
        organization: document.getElementById('signup-organization')?.value.trim(),
        cnpjCpf: document.getElementById('signup-document')?.value.trim(),
        category: document.getElementById('signup-category')?.value,
        sector: document.getElementById('signup-sector')?.value.trim(),
        oab: document.getElementById('signup-oab')?.value.trim() || undefined
      };

      try {
        submitButton.disabled = true;
        submitButton.textContent = 'Criando conta...';
        const result = await authAPI.register(payload);
        showToast(result.message || 'Conta criada. Verifique seu e-mail para continuar.', 'success');
        signupForm.reset();
        closeSignupModal();
        openLoginModal();
      } catch (err) {
        showToast(err.response?.data?.error || 'Não foi possível criar sua conta.', 'error');
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Criar minha conta';
      }
    });
  }

  let loginTrap = null;

  function openLoginModal() {
    if (loginModal) {
      loginModal.classList.add('active');
      loginTrap = createFocusTrap(loginModal);
      loginTrap.activate();
    }
  }

  function closeLoginModal() {
    if (loginModal) {
      loginModal.classList.remove('active');
      if (loginTrap) { loginTrap.deactivate(); loginTrap = null; }
    }
  }

  let signupTrap = null;

  function openSignupModal() {
    if (!signupModal) return;
    signupModal.classList.add('active');
    signupModal.setAttribute('aria-hidden', 'false');
    signupTrap = createFocusTrap(signupModal);
    signupTrap.activate();
    document.getElementById('signup-name')?.focus();
  }

  function closeSignupModal() {
    if (!signupModal) return;
    signupModal.classList.remove('active');
    signupModal.setAttribute('aria-hidden', 'true');
    if (signupTrap) { signupTrap.deactivate(); signupTrap = null; }
  }

  function updateSessionUI() {
    const user = TokenService.getCurrentUser();
    if (!userSessionBadge) return;

    if (user) {
      userSessionBadge.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="user-avatar-cell" style="width: 28px; height: 28px; font-size: 11px;">${user.avatar || 'LA'}</span>
          <div style="text-align: left; line-height: 1.2;">
            <strong style="font-size: 12.5px; color: var(--ink); display: block;">${user.name}</strong>
            <span style="font-size: 10.5px; color: var(--green-dark);">${user.tier?.toUpperCase()} • ${user.organization || ''}</span>
          </div>
          <button id="btn-logout" class="btn-icon" title="Encerrar Sessão" aria-label="Sair da conta" style="margin-left: 6px;">🚪</button>
        </div>
      `;

      document.getElementById('btn-logout')?.addEventListener('click', async () => {
        await authAPI.logout();
        showToast('Você saiu da sua conta.', 'info');
        updateSessionUI();
      });

      if (btnOpenLogin) btnOpenLogin.style.display = 'none';
    } else {
      userSessionBadge.innerHTML = '';
      if (btnOpenLogin) btnOpenLogin.style.display = 'inline-flex';
    }
  }
}

export default {
  initAuthModule
};
