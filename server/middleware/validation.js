/**
 * Leal.ai - Middleware de Validação com Zod
 * Validação rigorosa de todos os inputs no backend antes de qualquer processamento ou consulta.
 */

import { z } from 'zod';
import { validateCpfCnpj } from '../utils/cpfCnpjValidator.js';

/**
 * Validador genérico de schemas Zod
 * @param {z.ZodSchema} schema
 * @param {'body'|'query'|'params'} [source='body']
 */
export function validate(schema, source = 'body') {
  return (req, res, next) => {
    try {
      const parsed = schema.parse(req[source]);
      req[source] = parsed;
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        const issues = err.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }));

        return res.status(400).json({
          success: false,
          error: 'Dados de requisição inválidos.',
          details: issues
        });
      }
      return next(err);
    }
  };
}

// Schemas Zod de Entrada

export const loginSchema = z.object({
  email: z.string().trim().email({ message: 'E-mail corporativo inválido.' }),
  password: z.string().min(1, { message: 'A senha é obrigatória.' })
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, { message: 'Refresh token é obrigatório.' })
});

export const createAccountSchema = z.object({
  name: z.string().trim().min(2, { message: 'Nome do titular deve ter no mínimo 2 caracteres.' }),
  email: z.string().trim().email({ message: 'E-mail em formato inválido.' }),
  password: z.string().min(6, { message: 'A senha deve ter no mínimo 6 caracteres.' }).optional(),
  organization: z.string().trim().min(2, { message: 'Nome da organização é obrigatório.' }),
  cnpjCpf: z.string().trim().refine(val => {
    const result = validateCpfCnpj(val);
    return result.isValid;
  }, {
    message: 'CPF ou CNPJ inválido (dígitos verificadores incorretos).'
  }),
  category: z.enum(['empresa', 'escritorio', 'advogado', 'contabilidade', 'colaborador', 'leal_admin'], {
    errorMap: () => ({ message: 'Categoria de organização inválida.' })
  }),
  role: z.string().min(1, { message: 'Cargo/função é obrigatório.' }),
  roleName: z.string().optional(),
  tier: z.enum(['tier-1', 'tier-2', 'tier-3', 'tier-4', 'tier-5'], {
    errorMap: () => ({ message: 'Nível de hierarquia (Tier) inválido.' })
  }),
  sector: z.string().min(1, { message: 'Setor/departamento é obrigatório.' }),
  oab: z.string().optional().default('Não informada'),
  reportsTo: z.string().optional().default('Conselho / Diretoria Geral'),
  plan: z.string().optional().default('Pro'),
  permissions: z.array(z.string()).optional()
});

export const updateStatusSchema = z.object({
  status: z.enum(['active', 'disabled'], {
    errorMap: () => ({ message: 'Status deve ser "active" ou "disabled".' })
  })
});

export const registerSchema = z.object({
  name: z.string().trim().min(2, { message: 'Nome completo deve ter no mínimo 2 caracteres.' }),
  email: z.string().trim().email({ message: 'E-mail corporativo inválido.' }),
  password: z.string().min(8, { message: 'A senha deve ter no mínimo 8 caracteres.' })
    .max(128, { message: 'A senha deve ter no máximo 128 caracteres.' })
    .regex(/[a-z]/, { message: 'A senha deve conter pelo menos uma letra minúscula.' })
    .regex(/[A-Z]/, { message: 'A senha deve conter pelo menos uma letra maiúscula.' })
    .regex(/[0-9]/, { message: 'A senha deve conter pelo menos um número.' }),
  organization: z.string().trim().min(2, { message: 'Nome da organização é obrigatório.' }),
  cnpjCpf: z.string().trim().refine(val => {
    const result = validateCpfCnpj(val);
    return result.isValid;
  }, {
    message: 'CPF ou CNPJ inválido (dígitos verificadores incorretos).'
  }),
  category: z.enum(['empresa', 'escritorio', 'advogado', 'contabilidade'], {
    errorMap: () => ({ message: 'Categoria de organização inválida.' })
  }),
  sector: z.string().min(1, { message: 'Setor/departamento é obrigatório.' }),
  oab: z.string().optional().default('Não informada')
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, { message: 'Token de verificação é obrigatório.' })
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email({ message: 'E-mail corporativo inválido.' })
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, { message: 'Token é obrigatório.' }),
  password: z.string().min(8, { message: 'A senha deve ter no mínimo 8 caracteres.' })
    .max(128, { message: 'A senha deve ter no máximo 128 caracteres.' })
    .regex(/[a-z]/, { message: 'A senha deve conter pelo menos uma letra minúscula.' })
    .regex(/[A-Z]/, { message: 'A senha deve conter pelo menos uma letra maiúscula.' })
    .regex(/[0-9]/, { message: 'A senha deve conter pelo menos um número.' })
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, { message: 'A senha atual é obrigatória.' }),
  newPassword: z.string().min(8, { message: 'A nova senha deve ter no mínimo 8 caracteres.' })
    .max(128, { message: 'A nova senha deve ter no máximo 128 caracteres.' })
    .regex(/[a-z]/, { message: 'A nova senha deve conter pelo menos uma letra minúscula.' })
    .regex(/[A-Z]/, { message: 'A nova senha deve conter pelo menos uma letra maiúscula.' })
    .regex(/[0-9]/, { message: 'A nova senha deve conter pelo menos um número.' })
});

export const resendVerificationSchema = z.object({
  email: z.string().trim().email({ message: 'E-mail corporativo inválido.' })
});

// Questionário de risco trabalhista
const riskAnswersSchema = z.object({
  nomeTrabalhador: z.string().optional(),
  cargo: z.string().optional(),
  jornadaExtraFrequente: z.enum(['sim', 'nao']).optional(),
  intervaloIntrajornada: z.enum(['sim', 'nao']).optional(),
  remuneracaoPiso: z.enum(['sim', 'nao']).optional(),
  adiantamentoSemComprovacao: z.enum(['sim', 'nao']).optional(),
  terceirizacaoAtividadeFim: z.enum(['sim', 'nao']).optional(),
  terceirizacaoSemSupervisao: z.enum(['sim', 'nao']).optional(),
  bancoHorasHomologado: z.enum(['sim', 'nao']).optional(),
  adicionalInsalubridade: z.enum(['sim', 'nao']).optional(),
  contratoRegistro: z.enum(['sim', 'nao']).optional(),
  menorAprendiz: z.enum(['sim', 'nao']).optional()
});

export const analyzeRiskSchema = z.object({
  title: z.string().trim().min(2, { message: 'Título da análise é obrigatório.' }),
  description: z.string().optional(),
  answers: riskAnswersSchema
});

export const updateRiskStatusSchema = z.object({
  status: z.enum(['draft', 'reviewed', 'resolved'], {
    errorMap: () => ({ message: 'Status deve ser "draft", "reviewed" ou "resolved".' })
  })
});

export const generateContractSchema = z.object({
  tipo: z.enum(['clt', 'pj', 'estagio']).default('clt').optional(),
  nomeTrabalhador: z.string().trim().min(2, { message: 'Nome do trabalhador é obrigatório.' }),
  cargo: z.string().trim().min(2, { message: 'Cargo é obrigatório.' }),
  empresa: z.string().trim().min(2, { message: 'Empresa é obrigatória.' }),
  cnpj: z.string().optional(),
  cpf: z.string().optional(),
  endereco: z.string().optional(),
  cidade: z.string().optional(),
  salarioBase: z.union([z.number(), z.string()]).optional(),
  jornadaSemanal: z.string().optional(),
  dataAdmissao: z.string().optional(),
  dataAssinatura: z.string().optional(),
  sindicato: z.string().optional(),
  regime: z.enum(['clt', 'pj']).optional(),
  jornada: z.string().optional(),
  menor18: z.enum(['sim', 'nao']).optional(),
  clt: z.boolean().optional()
});

export const updateContractSchema = z.object({
  content: z.string().optional(),
  status: z.enum(['draft', 'pending', 'signed', 'archived'], {
    errorMap: () => ({ message: 'Status deve ser "draft", "pending", "signed" ou "archived".' })
  }).optional(),
  title: z.string().trim().min(1).optional()
});

export const createJourneyRecordSchema = z.object({
  userId: z.string().uuid({ message: 'Identificador do colaborador inválido.' }),
  date: z.string().optional(),
  clockIn: z.string().optional().nullable(),
  clockOut: z.string().optional().nullable(),
  notes: z.string().optional()
});

export const updateSubscriptionSchema = z.object({
  planId: z.enum(['starter', 'pro', 'enterprise'], {
    errorMap: () => ({ message: 'Plano deve ser "starter", "pro" ou "enterprise".' })
  }).optional(),
  status: z.enum(['trial', 'active', 'past_due', 'canceled', 'paused'], {
    errorMap: () => ({ message: 'Status de assinatura inválido.' })
  }).optional(),
  seatCount: z.number().int().min(1).max(9999).optional(),
  cancelAtPeriodEnd: z.boolean().optional()
});

export const generateInvoiceSchema = z.object({
  paymentMethod: z.enum(['pix', 'cartao', 'boleto']).default('pix').optional()
});

export const payInvoiceSchema = z.object({
  paymentMethod: z.enum(['pix', 'cartao', 'boleto']).optional()
}).optional();

export default {
  validate,
  loginSchema,
  refreshTokenSchema,
  createAccountSchema,
  updateStatusSchema,
  registerSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  resendVerificationSchema,
  analyzeRiskSchema,
  updateRiskStatusSchema,
  generateContractSchema,
  updateContractSchema,
  createJourneyRecordSchema,
  updateSubscriptionSchema,
  generateInvoiceSchema,
  payInvoiceSchema
};
