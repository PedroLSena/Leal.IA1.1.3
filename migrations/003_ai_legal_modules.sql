-- ==============================================================================
-- LEAL.AI SAAS - 003_AI_LEGAL_MODULES.SQL
-- Módulos de inteligência jurídica (Auditor de Riscos Trabalhistas) e futuros
-- (Contratos, Monitor de Jornada). Todos os registros são multi-tenant (org_id).
-- ==============================================================================

-- 1. TABELA DE ANÁLISES DE RISCO TRABALHISTA
CREATE TABLE IF NOT EXISTS risk_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    findings JSONB NOT NULL DEFAULT '[]',
    risk_level VARCHAR(20) NOT NULL,           -- 'low' | 'medium' | 'high' | 'critical'
    risk_score INTEGER NOT NULL DEFAULT 0,      -- 0 a 100
    recommendations JSONB NOT NULL DEFAULT '[]',
    summary TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'draft', -- 'draft' | 'reviewed' | 'resolved'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. TABELA DE CONTRATOS (geração de minutas / revisão)
CREATE TABLE IF NOT EXISTS contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    contract_type VARCHAR(50) NOT NULL,           -- 'prestacao_servicos', 'CLT', 'estagio'
    content TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',  -- 'draft' | 'pending' | 'signed' | 'archived'
    signed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. TABELA DE REGISTROS DE JORNADA / MONITOR DE PONTO
CREATE TABLE IF NOT EXISTS journey_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    clock_in TIMESTAMP WITH TIME ZONE,
    clock_out TIMESTAMP WITH TIME ZONE,
    hours_worked NUMERIC(5,2),
    overtime_hours NUMERIC(5,2),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ÍNDICES
CREATE INDEX IF NOT EXISTS idx_risk_org ON risk_scores(org_id);
CREATE INDEX IF NOT EXISTS idx_risk_level ON risk_scores(risk_level);
CREATE INDEX IF NOT EXISTS idx_contracts_org ON contracts(org_id);
CREATE INDEX IF NOT EXISTS idx_journey_org ON journey_records(org_id);
CREATE INDEX IF NOT EXISTS idx_journey_user ON journey_records(user_id);
