/**
 * Leal.ai - Módulo do Wizard Multi-passos de Criação de Contas
 */

import { accountsAPI, TokenService } from '../services/api.js';
import { localDb } from '../services/localDb.js';
import { showToast, formatAvatar, createFocusTrap } from '../utils/helpers.js';
import { validateCpfCnpj, validateEmail } from '../utils/validation.js';

export function initWizardModule(AppState, { onAccountCreated, switchTab }) {
  renderCategoryGrid();
  onCategoryChanged();
  renderTierSelectionGrid();
  populateSectorsDropdown();
  populateReportsToDropdown();
  renderPermissionsCheckboxes();
  updateLivePreview();

  // Listeners dos botões de navegação do wizard
  document.getElementById('btn-next-step')?.addEventListener('click', handleNextStep);
  document.getElementById('btn-prev-step')?.addEventListener('click', handlePrevStep);

  // Navegação direta nos números de passos
  document.querySelectorAll('.step-indicator').forEach(ind => {
    ind.addEventListener('click', () => {
      const step = parseInt(ind.dataset.step, 10);
      if (step < AppState.wizardStep || validateStep(AppState.wizardStep)) {
        goToStep(step);
      }
    });
  });

  // Atualização em tempo real do live preview
  const formInputs = document.querySelectorAll('#account-creation-form input, #account-creation-form select');
  formInputs.forEach(input => {
    input.addEventListener('input', updateLivePreview);
    input.addEventListener('change', updateLivePreview);
  });

  // Ajusta automaticamente o Tier quando o cargo muda
  document.getElementById('wizard-role')?.addEventListener('change', (e) => {
    const roleId = e.target.value;
    const catDef = AppState.definitions?.categories?.[AppState.selectedCategory];
    if (catDef) {
      const roleObj = catDef.roles.find(r => r.id === roleId);
      if (roleObj) {
        selectTier(roleObj.tier);
      }
    }
    updateLivePreview();
  });

  // Listener para submissão final do formulário
  document.getElementById('account-creation-form')?.addEventListener('submit', handleAccountSubmit);

  function renderCategoryGrid() {
    const container = document.getElementById('category-selection-grid');
    if (!container || !AppState.definitions?.categories) return;

    container.innerHTML = Object.entries(AppState.definitions.categories).map(([key, cat]) => `
      <div class="category-card ${AppState.selectedCategory === key ? 'selected' : ''}" data-cat="${key}" tabindex="0" role="button" aria-pressed="${AppState.selectedCategory === key}">
        <div class="cat-icon">${cat.icon}</div>
        <h3>${cat.name}</h3>
        <p>${cat.desc}</p>
        <span class="cat-tag">${cat.tag}</span>
      </div>
    `).join('');

    container.querySelectorAll('.category-card').forEach(card => {
      const selectCard = () => {
        container.querySelectorAll('.category-card').forEach(c => {
          c.classList.remove('selected');
          c.setAttribute('aria-pressed', 'false');
        });
        card.classList.add('selected');
        card.setAttribute('aria-pressed', 'true');
        AppState.selectedCategory = card.dataset.cat;
        onCategoryChanged();
      };

      card.addEventListener('click', selectCard);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectCard();
        }
      });
    });
  }

  function onCategoryChanged() {
    const cat = AppState.definitions?.categories?.[AppState.selectedCategory];
    if (!cat) return;

    // Destaca OAB se for escritório ou advogado
    const oabGroup = document.getElementById('group-oab');
    const oabHelp = document.getElementById('oab-help-text');
    if (AppState.selectedCategory === 'escritorio' || AppState.selectedCategory === 'advogado') {
      if (oabGroup) oabGroup.style.display = 'flex';
      if (oabHelp) oabHelp.textContent = 'Inscrição profissional na OAB (Ex: OAB/SP 123.456)';
    } else {
      if (oabGroup) oabGroup.style.display = 'flex';
      if (oabHelp) oabHelp.textContent = 'Opcional para colaboradores internos com formação jurídica';
    }

    // Atualiza opções de cargos
    const roleSelect = document.getElementById('wizard-role');
    if (roleSelect && cat.roles) {
      roleSelect.innerHTML = cat.roles.map(r => `
        <option value="${r.id}" data-tier="${r.tier}">${r.name} (${r.tierName})</option>
      `).join('');

      if (cat.roles.length > 0) {
        selectTier(cat.roles[0].tier);
      }
    }

    populateSectorsDropdown();
    populateReportsToDropdown();
    updateLivePreview();
  }

  function populateSectorsDropdown() {
    const select = document.getElementById('wizard-sector');
    if (!select) return;
    const cat = AppState.definitions?.categories?.[AppState.selectedCategory];
    if (!cat) return;

    select.innerHTML = `
      ${cat.defaultSectors.map(sec => `<option value="${sec}">${sec}</option>`).join('')}
      <option value="Outro">+ Cadastrar Novo Setor...</option>
    `;

    const modal = document.getElementById('new-sector-modal');
    const input = document.getElementById('new-sector-input');
    const btnConfirm = document.getElementById('btn-confirm-new-sector');
    const btnClose = document.getElementById('btn-close-new-sector');
    const btnCancel = document.getElementById('btn-cancel-new-sector');

    if (modal && input && btnConfirm && btnClose && btnCancel) {
      let sectorTrap = null;

      const closeModal = () => {
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
        input.value = '';
        if (sectorTrap) { sectorTrap.deactivate(); sectorTrap = null; }
        select.selectedIndex = 0;
      };

      const confirmSector = () => {
        const customSector = input.value.trim();
        if (!customSector) {
          showToast('Informe o nome do setor ou departamento.', 'error');
          return;
        }
        const newOpt = document.createElement('option');
        newOpt.value = customSector;
        newOpt.textContent = customSector;
        newOpt.selected = true;
        select.insertBefore(newOpt, select.lastElementChild);
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
        input.value = '';
        if (sectorTrap) { sectorTrap.deactivate(); sectorTrap = null; }
        updateLivePreview();
      };

      btnConfirm.addEventListener('click', confirmSector);
      btnClose.addEventListener('click', closeModal);
      btnCancel.addEventListener('click', closeModal);
      modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); confirmSector(); }
        if (e.key === 'Escape') closeModal();
      });

      select.onchange = () => {
        if (select.value === 'Outro') {
          modal.classList.add('active');
          modal.setAttribute('aria-hidden', 'false');
          sectorTrap = createFocusTrap(modal);
          sectorTrap.activate();
        }
      };
    }
  }

  function populateReportsToDropdown() {
    const select = document.getElementById('wizard-reports-to');
    if (!select) return;

    const eligibleSupervisors = AppState.accounts.filter(a => a.tier === 'tier-1' || a.tier === 'tier-2');

    select.innerHTML = `
      <option value="Conselho / Diretoria Geral">Conselho / Diretoria Geral (Nível Máximo)</option>
      ${eligibleSupervisors.map(u => `<option value="${u.name} (${u.roleName || u.role})">${u.name} — ${u.roleName || u.role} (${u.organization})</option>`).join('')}
      <option value="Outro">Outra Chefia Imediata...</option>
    `;
  }

  function renderTierSelectionGrid() {
    const container = document.getElementById('tier-selection-grid');
    if (!container || !AppState.definitions?.tiers) return;

    container.innerHTML = Object.entries(AppState.definitions.tiers).map(([tierKey, tier]) => `
      <div class="tier-card ${AppState.selectedTier === tierKey ? 'selected' : ''}" data-tier="${tierKey}" tabindex="0" role="button" aria-pressed="${AppState.selectedTier === tierKey}">
        <div class="tier-header">
          <span class="tier-badge ${tier.badgeClass}">${tierKey.toUpperCase()}</span>
        </div>
        <strong>${tier.name}</strong>
        <p>${tier.description}</p>
      </div>
    `).join('');

    container.querySelectorAll('.tier-card').forEach(card => {
      const selectCard = () => selectTier(card.dataset.tier);
      card.addEventListener('click', selectCard);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectCard();
        }
      });
    });
  }

  function selectTier(tierKey) {
    AppState.selectedTier = tierKey;
    const container = document.getElementById('tier-selection-grid');
    if (container) {
      container.querySelectorAll('.tier-card').forEach(c => {
        const isSelected = c.dataset.tier === tierKey;
        c.classList.toggle('selected', isSelected);
        c.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
      });
    }

    const tierDef = AppState.definitions?.tiers?.[tierKey];
    if (tierDef) {
      document.querySelectorAll('.perm-checkbox').forEach(cb => {
        cb.checked = tierDef.defaultPerms?.includes(cb.value) || false;
      });
    }
    updateLivePreview();
  }

  function renderPermissionsCheckboxes() {
    const container = document.getElementById('perm-matrix-grid');
    if (!container || !AppState.permissionsCatalog) return;

    const currentTier = AppState.definitions?.tiers?.[AppState.selectedTier];
    const defaults = currentTier ? (currentTier.defaultPerms || []) : [];

    container.innerHTML = AppState.permissionsCatalog.map(perm => `
      <label class="perm-box">
        <input type="checkbox" class="perm-checkbox" value="${perm.id}" ${defaults.includes(perm.id) ? 'checked' : ''} />
        <div class="perm-info">
          <div class="perm-title">${perm.name || perm.label}</div>
          <div class="perm-desc">${perm.description || perm.desc}</div>
        </div>
      </label>
    `).join('');

    container.querySelectorAll('.perm-checkbox').forEach(cb => {
      cb.addEventListener('change', updateLivePreview);
    });
  }

  function handleNextStep() {
    if (!validateStep(AppState.wizardStep)) return;
    if (AppState.wizardStep < 4) {
      goToStep(AppState.wizardStep + 1);
    } else {
      document.getElementById('account-creation-form')?.dispatchEvent(new Event('submit'));
    }
  }

  function handlePrevStep() {
    if (AppState.wizardStep > 1) {
      goToStep(AppState.wizardStep - 1);
    }
  }

  function goToStep(step) {
    AppState.wizardStep = step;

    document.querySelectorAll('.step-indicator').forEach(ind => {
      const s = parseInt(ind.dataset.step, 10);
      ind.classList.toggle('active', s === step);
      ind.classList.toggle('completed', s < step);
    });

    document.querySelectorAll('.wizard-step').forEach(ws => {
      ws.classList.toggle('active', parseInt(ws.dataset.step, 10) === step);
    });

    const btnPrev = document.getElementById('btn-prev-step');
    const btnNext = document.getElementById('btn-next-step');

    if (btnPrev) btnPrev.style.visibility = step === 1 ? 'hidden' : 'visible';
    if (btnNext) {
      if (step === 4) {
        btnNext.innerHTML = 'Concluir e Criar Conta na API <span>✓</span>';
        btnNext.className = 'btn-primary';
        btnNext.style.background = 'var(--green-dark)';
      } else {
        btnNext.innerHTML = 'Próximo Passo <span>→</span>';
        btnNext.className = 'btn-primary';
        btnNext.style.background = 'var(--ink)';
      }
    }

    updateLivePreview();
  }

  function validateStep(step) {
    if (step === 1) {
      if (!AppState.selectedCategory) {
        showToast('Selecione uma categoria de organização.', 'error');
        return false;
      }
      return true;
    }

    if (step === 2) {
      const orgName = document.getElementById('wizard-org-name')?.value.trim();
      const cnpjCpf = document.getElementById('wizard-cnpj-cpf')?.value.trim();

      if (!orgName) {
        showToast('Informe o Nome da Empresa ou Escritório.', 'error');
        document.getElementById('wizard-org-name')?.focus();
        return false;
      }
      if (!cnpjCpf) {
        showToast('Informe o CNPJ ou CPF para conformidade.', 'error');
        document.getElementById('wizard-cnpj-cpf')?.focus();
        return false;
      }

      const docCheck = validateCpfCnpj(cnpjCpf);
      if (!docCheck.isValid) {
        showToast('CPF ou CNPJ inválido (dígitos verificadores incorretos).', 'error');
        document.getElementById('wizard-cnpj-cpf')?.focus();
        return false;
      }
      return true;
    }

    if (step === 3) {
      const fullName = document.getElementById('wizard-full-name')?.value.trim();
      const email = document.getElementById('wizard-email')?.value.trim();
      const password = document.getElementById('wizard-password')?.value;

      if (!fullName) {
        showToast('Informe o Nome Completo do Usuário Titular.', 'error');
        document.getElementById('wizard-full-name')?.focus();
        return false;
      }
      if (!email || !validateEmail(email)) {
        showToast('Informe um e-mail corporativo válido.', 'error');
        document.getElementById('wizard-email')?.focus();
        return false;
      }
      if (password && password.length < 6) {
        showToast('A senha provisória deve conter no mínimo 6 dígitos.', 'error');
        document.getElementById('wizard-password')?.focus();
        return false;
      }
      return true;
    }

    if (step === 4) {
      const lgpdConsent = document.getElementById('wizard-lgpd-consent');
      if (lgpdConsent && !lgpdConsent.checked) {
        showToast('É necessário aceitar os Termos de Sigilo e LGPD.', 'error');
        return false;
      }
      return true;
    }

    return true;
  }

  function updateLivePreview() {
    const previewName = document.getElementById('preview-name');
    const previewOrg = document.getElementById('preview-org');
    const previewRole = document.getElementById('preview-role');
    const previewSector = document.getElementById('preview-sector');
    const previewTierPill = document.getElementById('preview-tier-pill');
    const previewAvatar = document.getElementById('preview-avatar');
    const previewPlan = document.getElementById('preview-plan');

    const fullName = document.getElementById('wizard-full-name')?.value.trim() || 'Nome do Usuário';
    const orgName = document.getElementById('wizard-org-name')?.value.trim() || 'Organização Jurídica';
    const sector = document.getElementById('wizard-sector')?.value || 'Setor Jurídico / RH';
    const roleSelect = document.getElementById('wizard-role');
    const roleText = roleSelect && roleSelect.options[roleSelect.selectedIndex] ? roleSelect.options[roleSelect.selectedIndex].text.split('(')[0].trim() : 'Cargo a Definir';
    const plan = document.getElementById('wizard-plan')?.value || 'Pro';

    if (previewName) previewName.textContent = fullName;
    if (previewOrg) previewOrg.textContent = orgName;
    if (previewRole) previewRole.textContent = roleText;
    if (previewSector) previewSector.textContent = sector;
    if (previewPlan) previewPlan.textContent = plan;
    if (previewAvatar) previewAvatar.textContent = formatAvatar(fullName);

    if (previewTierPill) {
      const tier = AppState.definitions?.tiers?.[AppState.selectedTier];
      previewTierPill.textContent = AppState.selectedTier.toUpperCase();
      previewTierPill.className = `hierarchy-level-pill ${tier?.badgeClass || ''}`;
    }

    const activePerms = Array.from(document.querySelectorAll('.perm-checkbox:checked')).map(cb => cb.value);
    const featureList = document.getElementById('preview-features-list');
    if (featureList) {
      featureList.innerHTML = `
        <li class="${activePerms.includes('contracts_create') ? 'enabled' : 'disabled'}">
          <i>${activePerms.includes('contracts_create') ? '✓' : '✗'}</i> Geração de Contratos com IA
        </li>
        <li class="${activePerms.includes('contracts_approve') ? 'enabled' : 'disabled'}">
          <i>${activePerms.includes('contracts_approve') ? '✓' : '✗'}</i> Aprovação de Minutas & Assinatura Digital
        </li>
        <li class="${activePerms.includes('risk_view_all') || activePerms.includes('risk_view_sector') ? 'enabled' : 'disabled'}">
          <i>${activePerms.includes('risk_view_all') || activePerms.includes('risk_view_sector') ? '✓' : '✗'}</i> Auditor Preditivo de Passivos
        </li>
        <li class="${activePerms.includes('journey_monitor_all') || activePerms.includes('journey_monitor_team') ? 'enabled' : 'disabled'}">
          <i>${activePerms.includes('journey_monitor_all') || activePerms.includes('journey_monitor_team') ? '✓' : '✗'}</i> Monitor de Jornada e Ponto
        </li>
        <li class="${activePerms.includes('team_manage') ? 'enabled' : 'disabled'}">
          <i>${activePerms.includes('team_manage') ? '✓' : '✗'}</i> Gestão de Hierarquia e Usuários
        </li>
      `;
    }
  }

  async function handleAccountSubmit(e) {
    e.preventDefault();
    if (!validateStep(1) || !validateStep(2) || !validateStep(3) || !validateStep(4)) return;

    const roleSelect = document.getElementById('wizard-role');
    const roleId = roleSelect ? roleSelect.value : 'padrao';
    const roleText = roleSelect && roleSelect.options[roleSelect.selectedIndex] ? roleSelect.options[roleSelect.selectedIndex].text.split('(')[0].trim() : 'Colaborador';

    const fullName = document.getElementById('wizard-full-name').value.trim();
    const email = document.getElementById('wizard-email').value.trim();
    const password = document.getElementById('wizard-password')?.value || undefined;
    const orgName = document.getElementById('wizard-org-name').value.trim();
    const cnpjCpf = document.getElementById('wizard-cnpj-cpf').value.trim();
    const oab = document.getElementById('wizard-oab')?.value.trim() || 'Não informada';
    const sector = document.getElementById('wizard-sector').value;
    const reportsTo = document.getElementById('wizard-reports-to').value;
    const plan = document.getElementById('wizard-plan').value;

    const selectedPerms = Array.from(document.querySelectorAll('.perm-checkbox:checked')).map(cb => cb.value);

    const payload = {
      name: fullName,
      email: email,
      password: password,
      organization: orgName,
      cnpjCpf: cnpjCpf,
      category: AppState.selectedCategory,
      role: roleId,
      roleName: roleText,
      tier: AppState.selectedTier,
      sector: sector,
      oab: oab,
      reportsTo: reportsTo,
      plan: plan,
      permissions: selectedPerms
    };

    const submitBtn = document.getElementById('btn-next-step');
    let apiResult = null;
    let apiError = null;

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Salvando cadastro...';
      }

      // 1) Persistência no backend (PostgreSQL) quando há sessão ativa
      if (TokenService.getAccessToken()) {
        try {
          apiResult = await accountsAPI.create(payload);
        } catch (err) {
          apiError = err.response?.data?.error || err.response?.data?.details?.[0]?.message || 'Backend indisponível.';
        }
      }

      // 2) Persistência no banco local (sempre) — alimenta o Painel Pessoal
      const { password: _omit, ...safePayload } = payload;
      const saved = await localDb.save({
        ...safePayload,
        id: apiResult?.data?.id || undefined,
        avatar: formatAvatar ? formatAvatar(fullName) : fullName.slice(0, 2).toUpperCase(),
        status: 'active',
        syncedWithApi: !!apiResult,
        createdAt: new Date().toISOString()
      });
      localDb.setCurrentId(saved.id);

      if (apiResult) {
        showToast(`Conta de ${fullName} salva no banco de dados.`, 'success');
      } else {
        showToast(
          apiError
            ? `Cadastro salvo no banco local (API: ${apiError}).`
            : 'Cadastro salvo no banco local do portal.',
          apiError ? 'warning' : 'success'
        );
      }

      if (apiResult?.temporaryPassword) {
        alert(`Conta criada com sucesso!\n\nSenha provisória gerada de forma segura:\n${apiResult.temporaryPassword}\n\nCopie e envie ao titular.`);
      }

      document.getElementById('account-creation-form').reset();
      goToStep(1);

      if (onAccountCreated && apiResult?.data) {
        try { await onAccountCreated(apiResult.data); } catch (_) { /* noop */ }
      }

      // 3) Abre o Painel Pessoal com os dados do usuário cadastrado
      if (submitBtn) submitBtn.textContent = 'Abrindo painel pessoal...';
      setTimeout(() => {
        window.location.href = `painel.html?id=${encodeURIComponent(saved.id)}`;
      }, 700);
      return;
    } catch (err) {
      showToast(err?.message || 'Falha ao salvar o cadastro.', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Concluir e Criar Conta <span>✓</span>';
      }
    }
  }

  return {
    renderCategoryGrid,
    onCategoryChanged,
    renderTierSelectionGrid,
    populateReportsToDropdown,
    updateLivePreview
  };
}

export default {
  initWizardModule
};
