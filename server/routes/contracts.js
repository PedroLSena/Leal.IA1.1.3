/**
 * Leal.ai - Rotas de Geração e Gestão de Contratos Trabalhistas
 * RBAC + isolamento multi-tenant.
 */

import { Router } from 'express';
import { Contract } from '../models/Contract.js';
import { AuditLog } from '../models/AuditLog.js';
import { generateContract } from '../utils/contractEngine.js';
import { authenticateJWT, requireAnyPermission } from '../middleware/auth.js';
import { scopeTenant } from '../middleware/tenantIsolation.js';
import { validate, generateContractSchema, updateContractSchema } from '../middleware/validation.js';

const router = Router();

router.use(authenticateJWT);
router.use(scopeTenant);

// Geração e revisão de contratos disponíveis a tiers que possuem contracts_create/review
router.use(requireAnyPermission(['contracts_create', 'contracts_review', 'contracts_approve']));

/**
 * POST /api/contracts/generate
 * Gera e persiste uma minuta de contrato CLT.
 */
router.post('/generate', validate(generateContractSchema), async (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  try {
    const result = generateContract(req.body);
    const orgId = req.orgScope ? req.orgScope : req.user.orgId;

    const saved = await Contract.create({
      orgId,
      createdBy: req.user.id,
      title: result.title,
      contractType: req.body.tipo || 'clt',
      content: result.content
    });

    await AuditLog.log({
      userId: req.user.id,
      action: 'CONTRACT_GENERATED',
      details: { contractId: saved.id, title: result.title },
      ipAddress: clientIp
    });

    return res.status(201).json({
      success: true,
      message: 'Minuta de contrato gerada com sucesso.',
      data: {
        id: saved.id,
        title: result.title,
        content: result.content,
        warnings: result.warnings,
        status: saved.status,
        createdAt: saved.created_at || saved.createdAt
      }
    });
  } catch (err) {
    console.error('[ContractGenerate Error]', err);
    return res.status(500).json({ success: false, error: 'Falha ao gerar o contrato.' });
  }
});

/**
 * GET /api/contracts
 * Lista contratos do tenant (admin vê todos).
 */
router.get('/', async (req, res) => {
  try {
    if (!req.orgScope) {
      return res.status(200).json({ success: true, data: [], count: 0 });
    }
    const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
    const items = await Contract.findAll({ orgId: req.orgScope, limit });
    return res.status(200).json({ success: true, count: items.length, data: items });
  } catch (err) {
    console.error('[ContractList Error]', err);
    return res.status(500).json({ success: false, error: 'Falha ao listar contratos.' });
  }
});

/**
 * GET /api/contracts/:id
 * Detalha contrato (isolamento de tenant; admin vê todos).
 */
router.get('/:id', async (req, res) => {
  try {
    const item = req.orgScope
      ? await Contract.findById(req.params.id, req.orgScope)
      : await Contract.findByIdAny(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Contrato não encontrado.' });
    }
    return res.status(200).json({ success: true, data: item });
  } catch (err) {
    console.error('[ContractDetail Error]', err);
    return res.status(500).json({ success: false, error: 'Falha ao obter o contrato.' });
  }
});

/**
 * PATCH /api/contracts/:id
 * Atualiza conteúdo/status do contrato (escopado por tenant).
 */
router.patch('/:id', validate(updateContractSchema), async (req, res) => {
  try {
    const orgId = req.orgScope ? req.orgScope : req.user.orgId;
    const updated = await Contract.update(req.params.id, orgId, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Contrato não encontrado.' });
    }

    await AuditLog.log({
      userId: req.user.id,
      action: 'CONTRACT_UPDATED',
      details: { contractId: req.params.id, status: req.body.status },
      ipAddress: req.ip || req.connection.remoteAddress
    });

    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    console.error('[ContractUpdate Error]', err);
    return res.status(500).json({ success: false, error: 'Falha ao atualizar o contrato.' });
  }
});

/**
 * DELETE /api/contracts/:id
 * Remove contrato (escopado por tenant).
 */
router.delete('/:id', async (req, res) => {
  try {
    const orgId = req.orgScope ? req.orgScope : req.user.orgId;
    const deleted = await Contract.delete(req.params.id, orgId);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Contrato não encontrado.' });
    }
    return res.status(200).json({ success: true, message: 'Contrato removido.' });
  } catch (err) {
    console.error('[ContractDelete Error]', err);
    return res.status(500).json({ success: false, error: 'Falha ao remover o contrato.' });
  }
});

export default router;
