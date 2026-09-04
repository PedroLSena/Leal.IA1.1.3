/**
 * Leal.ai - Rotas do Auditor de Riscos Trabalhistas
 * Análise, consulta e gestão de análises com isolamento multi-tenant e RBAC.
 */

import { Router } from 'express';
import { RiskScore } from '../models/RiskScore.js';
import { AuditLog } from '../models/AuditLog.js';
import { analyzeLaborRisk, countAnsweredQuestions } from '../utils/riskEngine.js';
import { authenticateJWT, requireTier } from '../middleware/auth.js';
import { scopeTenant } from '../middleware/tenantIsolation.js';
import { validate, analyzeRiskSchema, updateRiskStatusSchema } from '../middleware/validation.js';

const router = Router();

router.use(authenticateJWT);
router.use(scopeTenant);

// Auditor de riscos é função de gestão (tier-1 e tier-2)
router.use(requireTier(['tier-1', 'tier-2']));

/**
 * POST /api/risk/analyze
 * Roda o motor de análise e retorna o resultado. Opcionalmente persiste.
 */
router.post('/analyze', validate(analyzeRiskSchema), async (req, res) => {
  const { title, description, answers } = req.body;
  const clientIp = req.ip || req.connection.remoteAddress;

  try {
    const result = analyzeLaborRisk(answers || {});
    const answered = countAnsweredQuestions(answers || {});

    // Persiste a análise para o tenant do solicitante
    const orgId = req.orgScope || req.user.orgId;
    const saved = await RiskScore.create({
      orgId,
      createdBy: req.user.id,
      title,
      description: description || result.summary,
      findings: result.findings,
      riskLevel: result.level,
      riskScore: result.score,
      recommendations: result.recommendations,
      summary: result.summary
    });

    await AuditLog.log({
      userId: req.user.id,
      action: 'RISK_ANALYSIS_CREATED',
      details: { riskId: saved.id, level: result.level, score: result.score, answered },
      ipAddress: clientIp
    });

    return res.status(201).json({
      success: true,
      message: 'Análise de risco trabalhista concluída.',
      data: {
        id: saved.id,
        score: result.score,
        level: result.level,
        findings: result.findings,
        recommendations: result.recommendations,
        answeredQuestions: answered,
        createdAt: saved.created_at || saved.createdAt
      }
    });
  } catch (err) {
    console.error('[RiskAuditor Error]', err);
    return res.status(500).json({ success: false, error: 'Falha ao executar a análise de risco.' });
  }
});

/**
 * GET /api/risk
 * Lista análises do tenant. Admin vê todos os tenants.
 */
router.get('/', async (req, res) => {
  try {
    const orgId = req.orgScope ? req.orgScope : null;
    const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);

    // Admin global: filtra por org se especificada, senão não escopa
    if (!orgId) {
      return res.status(200).json({ success: true, data: [], count: 0 });
    }

    const items = await RiskScore.findAll({ orgId, limit });
    return res.status(200).json({ success: true, count: items.length, data: items });
  } catch (err) {
    console.error('[RiskList Error]', err);
    return res.status(500).json({ success: false, error: 'Falha ao listar análises.' });
  }
});

/**
 * GET /api/risk/:id
 * Detalha uma análise (isolamento de tenant; admin global vê todos).
 */
router.get('/:id', async (req, res) => {
  try {
    const orgId = req.orgScope ? req.orgScope : null;
    let item;
    if (orgId) {
      item = await RiskScore.findById(req.params.id, orgId);
    } else {
      item = await RiskScore.findByIdAny(req.params.id);
    }
    if (!item) {
      return res.status(404).json({ success: false, error: 'Análise não encontrada.' });
    }
    return res.status(200).json({ success: true, data: item });
  } catch (err) {
    console.error('[RiskDetail Error]', err);
    return res.status(500).json({ success: false, error: 'Falha ao obter a análise.' });
  }
});

/**
 * PATCH /api/risk/:id
 * Atualiza o status da análise (reviewed/resolved).
 */
router.patch('/:id', validate(updateRiskStatusSchema), async (req, res) => {
  try {
    const orgId = req.orgScope ? req.orgScope : req.user.orgId;
    const updated = await RiskScore.updateStatus(req.params.id, orgId, req.body.status);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Análise não encontrada.' });
    }

    await AuditLog.log({
      userId: req.user.id,
      action: 'RISK_STATUS_UPDATED',
      details: { riskId: req.params.id, status: req.body.status },
      ipAddress: req.ip || req.connection.remoteAddress
    });

    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    console.error('[RiskUpdate Error]', err);
    return res.status(500).json({ success: false, error: 'Falha ao atualizar a análise.' });
  }
});

/**
 * DELETE /api/risk/:id
 * Remove uma análise (isolamento de tenant).
 */
router.delete('/:id', async (req, res) => {
  try {
    const orgId = req.orgScope ? req.orgScope : req.user.orgId;
    const deleted = await RiskScore.delete(req.params.id, orgId);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Análise não encontrada.' });
    }
    return res.status(200).json({ success: true, message: 'Análise removida.' });
  } catch (err) {
    console.error('[RiskDelete Error]', err);
    return res.status(500).json({ success: false, error: 'Falha ao remover a análise.' });
  }
});

export default router;
