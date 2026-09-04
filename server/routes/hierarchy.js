/**
 * Leal.ai - Rotas de Hierarquia e Metadados Organizacionais
 */

import { Router } from 'express';
import {
  getHierarchyDefinitions,
  getPermissions,
  getRbacMatrix
} from '../controllers/hierarchyController.js';

const router = Router();

// Definições de categorias organizacionais e tiers
router.get('/definitions', getHierarchyDefinitions);

// Catálogo de permissões granulares
router.get('/permissions', getPermissions);

// Matriz RBAC
router.get('/matrix', getRbacMatrix);

export default router;
