/**
 * Leal.ai - Rotas do Monitor de Jornada e Ponto
 * Registro e análise de ponto com detecção de violações trabalhistas.
 * RBAC + isolamento multi-tenant.
 */

import { Router } from 'express';
import { JourneyRecord } from '../models/JourneyRecord.js';
import { User } from '../models/User.js';
import { AuditLog } from '../models/AuditLog.js';
import { detectViolations, computeJourneyStats } from '../utils/journeyEngine.js';
import { authenticateJWT, requireAnyPermission } from '../middleware/auth.js';
import { scopeTenant, loadTargetUser, ensureSameTenant } from '../middleware/tenantIsolation.js';
import { validate, createJourneyRecordSchema } from '../middleware/validation.js';

const router = Router();

router.use(authenticateJWT);
router.use(scopeTenant);
router.use(requireAnyPermission(['journey_monitor_all', 'journey_monitor_team', 'journey_adjust']));

/**
 * POST /api/journey/analyze
 * Roda o motor de detecção de violações sobre registros (sem persistir).
 */
router.post('/analyze', async (req, res) => {
  try {
    const { records } = req.body || {};
    if (!Array.isArray(records)) {
      return res.status(400).json({ success: false, error: 'Campo "records" deve ser um array.' });
    }
    const violations = detectViolations(records);
    const stats = computeJourneyStats(records);
    return res.status(200).json({ success: true, data: { violations, stats } });
  } catch (err) {
    console.error('[JourneyAnalyze Error]', err);
    return res.status(500).json({ success: false, error: 'Falha ao analisar jornada.' });
  }
});

/**
 * POST /api/journey/records
 * Registra um espelho de ponto para um colaborador do tenant.
 */
router.post('/records', validate(createJourneyRecordSchema), async (req, res) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  try {
    const orgId = req.orgScope ? req.orgScope : req.user.orgId;
    const { userId, date, clockIn, clockOut, notes } = req.body;

    // Isolamento: colaborador-alvo deve pertencer ao tenant
    const target = await User.findById(userId);
    if (!target) {
      return res.status(404).json({ success: false, error: 'Colaborador não encontrado.' });
    }
    if (orgId && target.org_id !== orgId) {
      return res.status(403).json({ success: false, error: 'Acesso negado. Colaborador de outra organização.' });
    }

    const stats = computeJourneyStats([{ clockIn, clockOut }]);
    const violations = detectViolations([{ clockIn, clockOut }]);

    const saved = await JourneyRecord.create({
      orgId,
      userId,
      date: date || new Date().toISOString().slice(0, 10),
      clockIn: clockIn || null,
      clockOut: clockOut || null,
      hoursWorked: stats.totalHours || null,
      overtimeHours: stats.totalOvertime,
      notes
    });

    await AuditLog.log({
      userId: req.user.id,
      action: 'JOURNEY_RECORD_CREATED',
      details: { recordId: saved.id, targetUserId: userId, totalHours: stats.totalHours },
      ipAddress: clientIp
    });

    return res.status(201).json({
      success: true,
      message: 'Registro de ponto salvo.',
      data: {
        id: saved.id,
        userId,
        hoursWorked: stats.totalHours,
        overtimeHours: stats.totalOvertime,
        violations
      }
    });
  } catch (err) {
    console.error('[JourneyCreate Error]', err);
    return res.status(500).json({ success: false, error: 'Falha ao salvar registro de ponto.' });
  }
});

/**
 * GET /api/journey/records?userId=...
 * Lista registros de ponto (de um colaborador ou de todo o tenant).
 */
router.get('/records', async (req, res) => {
  try {
    const orgId = req.orgScope ? req.orgScope : req.user.orgId;
    const { userId } = req.query;
    let records;
    if (userId) {
      records = await JourneyRecord.findByUserInOrg(userId, orgId);
    } else {
      records = await JourneyRecord.findAllInOrg(orgId);
    }

    // Executa detecção de violações sobre os registros retornados
    const violations = detectViolations(records);
    const stats = computeJourneyStats(records);

    return res.status(200).json({
      success: true,
      count: records.length,
      data: { records, violations, stats }
    });
  } catch (err) {
    console.error('[JourneyList Error]', err);
    return res.status(500).json({ success: false, error: 'Falha ao listar registros.' });
  }
});

/**
 * GET /api/journey/records/user/:id
 * Lista registros de um colaborador específico (com checagem de tenant).
 */
router.get('/records/user/:id', loadTargetUser, ensureSameTenant, async (req, res) => {
  try {
    const orgId = req.orgScope ? req.orgScope : req.user.orgId;
    const records = await JourneyRecord.findByUserInOrg(req.params.id, orgId);
    const violations = detectViolations(records);
    const stats = computeJourneyStats(records);
    return res.status(200).json({
      success: true,
      count: records.length,
      data: { userId: req.params.id, records, violations, stats }
    });
  } catch (err) {
    console.error('[JourneyUser Error]', err);
    return res.status(500).json({ success: false, error: 'Falha ao listar registros do colaborador.' });
  }
});

/**
 * DELETE /api/journey/records/:id
 * Remove um registro de ponto (escopado por tenant).
 */
router.delete('/records/:id', async (req, res) => {
  try {
    const orgId = req.orgScope ? req.orgScope : req.user.orgId;
    const deleted = await JourneyRecord.delete(req.params.id, orgId);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Registro não encontrado.' });
    }
    return res.status(200).json({ success: true, message: 'Registro removido.' });
  } catch (err) {
    console.error('[JourneyDelete Error]', err);
    return res.status(500).json({ success: false, error: 'Falha ao remover o registro.' });
  }
});

export default router;
