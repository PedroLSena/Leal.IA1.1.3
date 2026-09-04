-- ==============================================================================
-- LEAL.AI SAAS - 004_BILLING.SQL
-- Assinaturas, faturas e planos. Todos os registros são vinculados a organizações
-- (billing multi-tenant / por organização).
-- ==============================================================================

-- 1. TABELA DE PLANOS (catálogo) - seed de referência
CREATE TABLE IF NOT EXISTS plans (
    id VARCHAR(30) PRIMARY KEY,             -- 'starter' | 'pro' | 'enterprise'
    name VARCHAR(80) NOT NULL,
    description TEXT,
    price_monthly_brl NUMERIC(10,2) NOT NULL DEFAULT 0,
    max_users INTEGER,
    features JSONB NOT NULL DEFAULT '[]'
);

-- Seed de planos
INSERT INTO plans (id, name, description, price_monthly_brl, max_users, features) VALUES
    ('starter', 'Starter', 'Para advogados solo e pequenos negócios', 99.00, 5,
        '["Auditor de riscos limitado", "Até 5 usuários", "Gerador de contratos CLT", "Suporte por e-mail"]'),
    ('pro', 'Pro', 'Para startups e médias empresas', 299.00, 25,
        '["Auditor de riscos ilimitado", "Até 25 usuários", "Gerador de contratos CLT/PJ/Estágio", "Monitor de jornada", "Integração eSocial"]'),
    ('enterprise', 'Enterprise', 'Para bancas jurídicas e grandes operações', 999.00, 999,
        '["Tudo do Pro", "Usuários ilimitados", "APIs & webhooks", "Suporte prioritário", "SLA dedicado"]')
ON CONFLICT (id) DO NOTHING;

-- 2. TABELA DE ASSINATURAS (uma por organização)
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan_id VARCHAR(30) NOT NULL REFERENCES plans(id),
    status VARCHAR(20) NOT NULL DEFAULT 'trial',  -- 'trial' | 'active' | 'past_due' | 'canceled' | 'paused'
    trial_ends_at TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    seat_count INTEGER NOT NULL DEFAULT 1,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (org_id)
);

-- 3. TABELA DE FATURAS
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    amount_brl NUMERIC(10,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open',  -- 'open' | 'paid' | 'overdue' | 'void'
    payment_method VARCHAR(20),                  -- 'pix' | 'boleto' | 'card' | 'manual'
    payment_details JSONB,                       -- pixCode / boleto linha digitável
    transaction_id VARCHAR(120),                 -- id da transação (sandbox)
    period_start TIMESTAMP WITH TIME ZONE,
    period_end TIMESTAMP WITH TIME ZONE,
    due_date TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ÍNDICES
CREATE INDEX IF NOT EXISTS idx_subscriptions_org ON subscriptions(org_id);
CREATE INDEX IF NOT EXISTS idx_invoices_org ON invoices(org_id);
CREATE INDEX IF NOT EXISTS idx_invoices_sub ON invoices(subscription_id);
