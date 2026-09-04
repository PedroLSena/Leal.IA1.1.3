/**
 * Leal.ai - Rotas de Trilha de Auditoria (Audit Logs)
 * Leitura restrita a gestores (tier-1/tier-2 com permissão) e Super Admins.
 */

import { Router } from 'express';
import { AuditLog } from '../models/AuditLog.js';
import { authenticateJWT, requirePermission } from '../middleware/auth.js';
import { scopeTenant } from '../middleware/tenantIsolation.js';

const router = Router();

router.use(authenticateJWT);
router.use(scopeTenant);

/**
 * Retorna os logs de auditoria recentes do tenant (admin vê todos).
 * Exige permissão de gestão de equipe (team_manage) - disponível em tier-1 e tier-2.
 */
router.get('/', requirePermission('team_manage'), async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
    const logs = await AuditLog.getRecent(limit);

    // Isolamento multi-tenant: admin vê todos; demais veem apenas logs do seu usuário/tenant
    let scoped = logs;
    if (req.tenantAccess !== 'all') {
      scoped = logs.filter(log =>
        log.user_id === req.user.id ||
        log.details?.targetUserId === req.user.id
      );
    }

    return res.status(200).json({
      success: true,
      count: scoped.length,
      data: scoped
    });
  } catch (err) {
    console.error('[AuditRoutes]', err);
    return res.status(500).json({ success: false, error: 'Falha ao recuperar logs de auditoria.' });
  }
});

export default router;
