# Leal.IA 1.1.3

> Plataforma SaaS de alta performance e segurança corporativa para gestão preventiva de passivos trabalhistas, monitoramento de jornada e geração assistida de contratos por Inteligência Artificial, com controle de acesso baseado em cargos (**RBAC**) e hierarquias em conformidade com o Provimento da OAB e as diretrizes da LGPD.

---

## 🏛️ 1. Arquitetura e Estrutura do Projeto

O sistema foi transformado de um protótipo estático com `localStorage` em uma aplicação **Full-Stack SaaS moderna**, robusta e preparada para escala em nuvem:

```text
Leal.IA/
├── public/
│   └── favicon.svg              # Ícone da aplicação
├── src/                         # Frontend Modular & Moderno
│   ├── index.html               # Landing page institucional
│   ├── cadastro.html            # Portal de gestão de contas e hierarquias
│   ├── styles/
│   │   ├── variables.css        # Design tokens e variáveis de cores/fontes
│   │   ├── main.css             # Estilos globais e landing page
│   │   ├── cadastro.css         # Estilos da ferramenta de hierarquia
│   │   └── components/
│   │       ├── modals.css       # Modais acessíveis com backdrop blur
│   │       └── toast.css        # Notificações toast acessíveis (ARIA live)
│   └── js/
│       ├── modules/
│       │   ├── auth.js          # Gestão de sessão e modal de login
│       │   ├── wizard.js        # Wizard multi-passos com live preview
│       │   ├── accounts.js      # Tabela de contas, filtros e ações com ARIA
│       │   ├── organogram.js    # Organograma visual em árvore hierárquica
│       │   ├── matrix.js        # Matriz interativa de permissões RBAC
│       │   └── simulator.js     # Simulador de visão e restrições por perfil
│       ├── services/
│       │   └── api.js           # Cliente Axios com interceptors e refresh token
│       ├── utils/
│       │   ├── validation.js    # Validação matemática de CPF/CNPJ e inputs
│       │   └── helpers.js       # Formatadores, exportação JSON e toasts
│       └── app.js               # Entry point e orquestração do frontend
├── server/                      # Backend Node.js + Express
│   ├── config/
│   │   └── database.js          # Pool PostgreSQL + Fallback resiliente dev
│   ├── middleware/
│   │   ├── auth.js              # Verificação JWT e verificação RBAC por Tier
│   │   ├── validation.js        # Validação de schemas com Zod
│   │   ├── rateLimit.js         # Proteção contra força bruta e DoS
│   │   └── errorHandler.js      # Tratamento centralizado de exceções
│   ├── models/
│   │   ├── User.js              # Modelo de contas com prepared statements
│   │   ├── Organization.js      # Modelo de organizações / bancas
│   │   ├── Permission.js        # Catálogo de permissões e definições RBAC
│   │   └── AuditLog.js          # Trilha de auditoria e conformidade LGPD
│   ├── routes/
│   │   ├── auth.js              # Rotas de login, refresh e logout
│   │   ├── accounts.js          # Rotas de contas e estatísticas
│   │   └── hierarchy.js         # Rotas de catálogo e matriz de acesso
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── accountController.js
│   │   └── hierarchyController.js
│   ├── utils/
│   │   ├── cpfCnpjValidator.js  # Validador de CPF/CNPJ (módulo 11 oficial)
│   │   └── passwordGenerator.js # Gerador de senhas e bcrypt (cost 12)
│   └── server.js                # Entry point com Helmet, CORS e Rate Limiter
├── migrations/
│   └── 001_initial_schema.sql   # Script DDL do banco de dados PostgreSQL
├── seeds/
│   └── demo_accounts.js         # Seeder com 12 contas corporativas realistas
├── tests/                       # Suíte de Testes Automatizados (Vitest)
│   ├── cpfCnpjValidator.test.js # Testes do validador de CPF e CNPJ
│   ├── passwordGenerator.test.js# Testes de geração e hashing de senhas
│   ├── auth.test.js             # Testes de rotas de autenticação JWT
│   └── accounts.test.js         # Testes de CRUD de contas e validações Zod
├── .env.example                 # Exemplo documentado de variáveis de ambiente
├── .gitignore                   # Exclusão de segredos e node_modules
├── package.json                 # Manifesto de dependências e scripts npm
├── vite.config.js               # Configuração do Vite (build e proxy reverso)
└── README.md                    # Documentação técnica completa
```

---

## 🛡️ 2. Segurança e Critérios de Governança

1. **Senhas Criptografadas com Bcrypt**: Todas as senhas de usuários são salvas após processamento com `bcrypt` (cost factor 12). Nenhuma senha trafega ou é armazenada em texto plano.
2. **Autenticação JWT com Rotação de Refresh Tokens**:
   - Access tokens com validade curta de **15 minutos**.
   - Refresh tokens com validade de **7 dias**, armazenados com hash SHA-256 no banco e submetidos a rotação a cada renovação.
3. **Validação Matemática Estrita de CPF e CNPJ**:
   - Implementação completa dos algoritmos da Receita Federal (módulo 11 com pesos decrescentes e cíclicos).
   - Rejeição garantida de sequências repetidas conhecidas (como `111.111.111-11` ou `000.000.000-00`).
4. **Proteção contra Força Bruta (Rate Limiting)**:
   - Limite de **5 tentativas de login por minuto por IP**, bloqueando ataques de força bruta.
   - Limite geral de **100 requisições por minuto por IP** para rotas gerais da API.
5. **Prevenção de Injeção SQL**:
   - Todas as queries do backend utilizam parâmetros preparados (`$1, $2...`) via `pg.Pool`, impossibilitando injeção SQL.
6. **Headers de Segurança e CSP com Helmet**:
   - Content Security Policy (CSP), mitigação de XSS, prevenção de Clickjacking (`frameguard`), e HSTS.
7. **Política de CORS Restritiva**:
   - Apenas origens autorizadas definidas nas variáveis de ambiente têm permissão para consumir a API.
8. **Trilha de Auditoria (Audit Logs)**:
   - Todas as ações críticas (login, login falho, criação de conta, alteração de status, exclusão e rotação de tokens) são registradas com IP, User-Agent e timestamp para atender aos requisitos da LGPD.
9. **Identificadores Criptograficamente Seguros (UUID v4)**:
   - Eliminação de sequências previsíveis (`usr-001`), substituídas por UUIDs version 4 (`9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d`).

---

## 🚀 3. Guia de Instalação e Execução

### Pré-requisitos
- **Node.js**: v18+ (recomendado v20+)
- **NPM**: v9+
- **PostgreSQL**: v13+ (opcional para desenvolvimento, pois o backend conta com fallback inteligente em memória/arquivo com prepared statements para execução imediata).

### Passo 1: Clonar e Instalar Dependências
```bash
# Na pasta do projeto:
npm install
```

### Passo 2: Configurar Variáveis de Ambiente
Copie o arquivo de exemplo `.env.example` para `.env`:
```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas configurações de banco e chaves secretas:
```env
PORT=3001
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/leal_db
JWT_SECRET=sua_chave_secreta_jwt_de_alta_entropia_2026
JWT_REFRESH_SECRET=sua_chave_secreta_para_refresh_tokens_2026
```

### Passo 3: Executar Migrações e Popular Dados Iniciais
```bash
# Executa migrações SQL e popula as 12 contas de demonstração:
npm run db:seed
```

> **Credenciais Padrão de Demonstração**:
> - E-mail do Administrador: `admin@leal.ai`
> - E-mail da Sócia de Escritório: `dra.maria.oliveira@oliveiramedeiros.adv.br`
> - E-mail do CEO Corporativo: `marcos@techflow.io`
> - Senha padrão de teste: `Leal@2026#Segura`

### Passo 4: Iniciar a Aplicação
Você pode rodar o backend e o frontend de duas formas:

#### Opção A: Servidor Backend Full-Stack (Recomendado)
```bash
npm start
```
- Acesse a aplicação em: **`http://localhost:3001/cadastro`**
- Acesse a landing page em: **`http://localhost:3001`**
- API REST disponível em: **`http://localhost:3001/api`**

#### Opção B: Modo Desenvolvimento Frontend com Vite
```bash
# Terminal 1 - Backend:
npm run server

# Terminal 2 - Frontend Vite HMR:
npm run dev
```
- Acesse o Vite em: **`http://localhost:5173/cadastro.html`** (com proxy reverso automático para `/api`).

---

## 🧪 4. Execução dos Testes Automatizados

O projeto conta com suíte completa de testes unitários e de integração utilizando **Vitest** e **Supertest**:

```bash
npm test
```

### Cobertura de Testes:
- `tests/cpfCnpjValidator.test.js`: 13 testes de dígitos verificadores, rejeição de repetidos e máscaras.
- `tests/passwordGenerator.test.js`: 6 testes de entropia de senhas, validação de regras e hashing bcrypt.
- `tests/auth.test.js`: 6 testes de login, credenciais incorretas, rotação de refresh token e proteção de rotas com JWT.
- `tests/accounts.test.js`: 5 testes de listagem de contas, validação Zod de CPF/CNPJ, criação com UUID v4 e alteração de status.

---

## 📡 5. Documentação da API RESTful

### 5.1 Autenticação (`/api/auth`)

#### `POST /api/auth/login`
Autentica o usuário corporativo com e-mail e senha. Limitado a 5 tentativas/min por IP.

- **Request Body**:
```json
{
  "email": "dra.maria.oliveira@oliveiramedeiros.adv.br",
  "password": "Leal@2026#Segura"
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Autenticação realizada com sucesso.",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "7a35606d-e4fb-4632-9cb7-285b0d62d295",
    "name": "Dra. Maria Oliveira",
    "email": "dra.maria.oliveira@oliveiramedeiros.adv.br",
    "organization": "Oliveira & Medeiros Sociedade de Advogados",
    "tier": "tier-1",
    "roleName": "Sócia Administradora (Managing Partner)",
    "permissions": ["contracts_create", "contracts_approve", "risk_view_all"]
  }
}
```

#### `POST /api/auth/refresh`
Renova o access token rotacionando o refresh token atual.

- **Request Body**:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```
- **Response (200 OK)**: Retorna novo par `accessToken` e `refreshToken`.

#### `GET /api/auth/me`
Retorna dados e permissões do usuário atualmente autenticado. Requer cabeçalho `Authorization: Bearer <token>`.

---

### 5.2 Gestão de Contas (`/api/accounts`)

#### `GET /api/accounts`
Lista contas cadastradas com suporte a busca textual e filtros.
- **Query Params**: `?search=maria&category=escritorio&tier=tier-1`
- **Response (200 OK)**:
```json
{
  "success": true,
  "count": 12,
  "data": [ ... ]
}
```

#### `GET /api/accounts/stats`
Retorna contagem total de contas, organizações únicas e advogados/OABs ativos.

#### `POST /api/accounts`
Cria uma nova conta hierárquica validada com Zod, com senha hasheada e ID UUID.

- **Request Body**:
```json
{
  "name": "Dr. Fernando Siqueira",
  "email": "fernando@siqueira.adv.br",
  "organization": "Siqueira Advocacia Trabalhista",
  "cnpjCpf": "33.000.167/0001-01",
  "category": "escritorio",
  "role": "adv_senior",
  "tier": "tier-2",
  "sector": "Consultoria Preventiva B2B",
  "oab": "OAB/SP 320.100",
  "plan": "Enterprise",
  "permissions": ["contracts_create", "contracts_review", "journey_monitor_team"]
}
```
- **Response (201 Created)**: Retorna conta criada e, se nenhuma senha foi informada, a `temporaryPassword` gerada com 18 caracteres de alta entropia.

#### `PATCH /api/accounts/:id/status`
Alterna o status entre `active` e `disabled`.

#### `DELETE /api/accounts/:id`
Exclui uma conta e grava o registro na trilha de auditoria.

---

### 5.3 Metadados de Hierarquia (`/api/hierarchy`)

- `GET /api/hierarchy/definitions`: Retorna categorias organizacionais e descrições dos Tiers 1 a 5.
- `GET /api/hierarchy/permissions`: Retorna o catálogo das permissões granulares do sistema.
- `GET /api/hierarchy/matrix`: Retorna a matriz RBAC com mapeamento de recursos por nível de alçada.

---

## ♿ 6. Acessibilidade e Inclusão

A interface do portal `cadastro.html` foi concebida com foco em acessibilidade (WCAG 2.1 AA):
- **ARIA Labels**: Todos os botões de ação contêm descrições para leitores de tela (`aria-label="Ver detalhes da conta de Dra. Maria Oliveira"`).
- **Diálogos Acessíveis**: Os modais implementam `role="dialog"`, `aria-modal="true"` e fechamento automático ao pressionar `Escape`.
- **Navegação por Teclado**: Todo elemento interativo (cards de categorias, tiers, abas e linhas de organograma) pode ser acessado via `Tab` e ativado com `Enter` ou `Espaço`.
- **Focus Rings Visíveis**: Anéis de foco estilizados (`:focus-visible`) com contraste elevado.
- **Alertas Ao Vivo**: Notificações toast contêm `aria-live="polite"` e `role="status"` ou `role="alert"`.

---

## 📄 7. Licença

Este projeto é protegido sob os termos da [Licença MIT](LICENSE).
