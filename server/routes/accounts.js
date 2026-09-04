/**
 * Leal.ai - Rotas de Gestão de Contas Hierárquicas
 */

import { Router } from 'express';
import {
  listAccounts,
  getAccountById,
  createAccount,
  updateAccountStatus,
  deleteAccount,
  getStats
} from '../controllers/accountController.js';
import { authenticateJWT, requirePermission } from '../middleware/auth.js';
import { scopeTenant, ensureSameTenant, loadTargetUser } from '../middleware/tenantIsolation.js';
import { validate, createAccountSchema, updateStatusSchema } from '../middleware/validation.js';

const router = Router();

// Todas as rotas de contas exigem autenticação JWT + isolamento multi-tenant.
router.use(authenticateJWT);
router.use(scopeTenant);

// Estatísticas do ecossistema (dentro do tenant do usuário autenticado)
router.get('/stats', getStats);

// Listagem de contas do tenant do usuário autenticado
router.get('/', listAccounts);

// Detalhes de uma conta por ID (verifica pertencimento ao mesmo tenant)
router.get('/:id', loadTargetUser, ensureSameTenant, getAccountById);

// Criação de nova conta (com validação Zod rigorosa) - exige permissão de gestão de equipe
router.post('/', requirePermission('team_manage'), validate(createAccountSchema), createAccount);

// Atualização de status da conta (Ativar / Desativar) - exige permissão de gestão
router.patch('/:id/status', loadTargetUser, ensureSameTenant, requirePermission('team_manage'), validate(updateStatusSchema), updateAccountStatus);

// Remoção de conta - exige permissão de gestão
router.delete('/:id', loadTargetUser, ensureSameTenant, requirePermission('team_manage'), deleteAccount);

export default router;
