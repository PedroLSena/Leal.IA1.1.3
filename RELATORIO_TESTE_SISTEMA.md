# Relatório de teste do sistema — Leal.ai

Data: 03/09/2026  
Ambiente: `http://localhost:3001` (desenvolvimento; fallback local ativo, sem PostgreSQL)

> Atualização — reteste após novo desenvolvimento: uma instância limpa do código atual foi executada em `http://localhost:3002` em 04/09/2026. A seção abaixo substitui as conclusões de segurança e validação anteriores quando houver divergência.

## Reteste do código atualizado

### Validações aprovadas

| Área | Resultado |
| --- | --- |
| Suíte automatizada | **105/105 testes aprovados**, distribuídos em 9 arquivos |
| Build de produção | Aprovado; 76 módulos transformados pelo Vite |
| Saúde da API | `GET /api/health` retornou 200 |
| Acesso anônimo a contas | **Corrigido:** `GET /api/accounts` sem token retornou 401 |
| Login, perfil e rotação de token | Aprovados; refresh token foi substituído corretamente |
| Criação de conta autenticada | Retornou 201 |
| Testes das novas áreas | A suíte aprovou contratos (11), riscos (12), jornada (14), faturamento (9) e fluxo de autenticação (15) |

### Achados do reteste

#### Crítico — criação de conta pode escapar do tenant do solicitante

Embora o CRUD agora exija JWT e valide o tenant nas leituras, alterações e exclusões, `POST /api/accounts` ainda aceita `organization` e `cnpjCpf` fornecidos pelo cliente. O controller usa esses campos em `Organization.findOrCreate` e não impõe `req.orgScope` ao criar o usuário.

No teste, um administrador autenticado de um tenant criou a conta com um CNPJ de outro tenant. A criação retornou 201, mas a conta resultante ficou em outra organização e o mesmo administrador recebeu 403 ao tentar alterar ou excluí-la. Isso confirma a alocação indevida entre tenants.

Correção recomendada: para qualquer usuário que não seja superadministrador, ignorar organização e CNPJ enviados pelo cliente e usar exclusivamente `req.user.orgId`/`req.orgScope`. A criação de uma organização nova deve ser um fluxo separado e privilegiado.

#### Alta — dados persistidos de desenvolvimento estão inconsistentes

Na base fallback local, `admin@leal.ai` aparece associado a uma organização de escritório, apesar de o seed atual defini-lo como `leal_admin` da Leal.ai. O CNPJ associado também foi rejeitado pela validação no fluxo de criação. Isso impediu um CRUD manual completo no tenant atual, embora a suíte isolada tenha passado.

Correção recomendada: não reutilizar `.dev_database.json` entre mudanças estruturais de seed/modelo; versionar migrações do fallback ou recriar a base de desenvolvimento de forma explícita e segura.

#### Média — resposta CORS ainda tende a 500

O middleware de CORS atribui `err.status = 403`, mas o manipulador central lê `err.statusCode`. Assim, uma origem rejeitada pode continuar recebendo 500. Padronizar a propriedade para `statusCode` ou aceitar ambas no `errorHandler`.

### Limpeza do teste

A instância isolada foi encerrada. A conta de teste que caiu no tenant incorreto foi removida da base local, juntamente com sua permissão associada; a integridade JSON foi validada depois da limpeza.

## Resultado executivo

O fluxo principal de API foi aprovado: saúde, autenticação, renovação de token, criação, consulta, alteração de status, exclusão e logout responderam como esperado. A conta temporária criada para este teste foi excluída ao final.

Há, contudo, dois bloqueadores para produção: operações de contas e dados pessoais estão acessíveis sem autenticação, e a rota amigável `/cadastro` entrega o frontend não compilado.

## Fluxo executado

| Etapa | Resultado | Evidência |
| --- | --- | --- |
| Saúde da API | Aprovado | `GET /api/health` retornou 200 |
| Login de administrador | Aprovado | tokens de acesso e renovação emitidos |
| Perfil autenticado | Aprovado | `GET /api/auth/me` retornou 200 |
| Rotação de refresh token | Aprovado | token novo e diferente do anterior |
| Criar conta temporária | Aprovado | `POST /api/accounts` retornou 201 |
| Consultar conta criada | Aprovado | dados e e-mail conferiram |
| Desativar conta | Aprovado | `PATCH /api/accounts/:id/status` retornou 200 |
| Excluir conta temporária | Aprovado | `DELETE /api/accounts/:id` retornou 200 |
| Logout | Aprovado | `POST /api/auth/logout` retornou 200 |
| Build e testes automatizados | Aprovado | 30/30 testes Vitest e build Vite concluídos |

## Interface e entrega do frontend

- A landing page (`/`) retorna 200.
- A página compilada (`/cadastro.html`) retorna 200 e referencia os arquivos versionados em `assets/`.
- A rota anunciada na documentação, `/cadastro`, retorna 200, porém entrega `src/cadastro.html`, com `src="js/app.js"`, em vez do build. Esse JS contém imports de pacote como `axios`, que não são resolvidos diretamente pelo navegador fora do Vite. Portanto, o portal pode falhar nessa URL em produção.
- Não foi feita inspeção visual por screenshot ou teste manual de layout, pois não há navegador automatizado disponível neste ambiente. A validação da interface foi estática e por resposta HTTP.

## Falhas encontradas

### Crítica — CRUD de contas sem autenticação

O teste confirmou que `GET /api/accounts`, sem cabeçalho `Authorization`, retorna 200 e expõe as 12 contas existentes, incluindo campos de perfil e documento. O código também deixa criação, alteração de status e exclusão sem `authenticateJWT` ou `requirePermission`.

Impacto: qualquer pessoa com acesso à API pode consultar dados pessoais ou modificar contas.

Correção: proteger as rotas em `server/routes/accounts.js`, definir permissões específicas por ação e limitar consultas à organização do usuário autenticado.

### Alta — rota `/cadastro` entrega fonte, não build

Impacto: caminho recomendado no README pode apresentar interface sem funcionamento, além de expor `src/` pelo servidor Express.

Correção: em produção, servir apenas `dist`; fazer `/cadastro` responder com `dist/cadastro.html` (ou redirecionar para `/cadastro.html`).

### Média — origem CORS rejeitada retorna 500

Uma requisição com `Origin: https://origem-invalida.example` foi rejeitada, mas recebeu HTTP 500. A política bloqueia a origem corretamente, porém a resposta deveria ser tratada como erro CORS previsível (por exemplo, 403), sem registrar erro interno.

### Média — ambiente de desenvolvimento usa base persistente local

O servidor iniciou em modo fallback porque PostgreSQL não está disponível. O arquivo `.dev_database.json` persiste dados de usuários, auditoria e hashes localmente e não está ignorado no `.gitignore`.

## Recomendações em ordem

1. Aplicar autenticação, RBAC e isolamento organizacional ao CRUD de contas.
2. Corrigir a entrega da rota `/cadastro` e parar de expor `src/` em produção.
3. Adicionar `.dev_database.json` ao `.gitignore` e desativar fallback/seeding automático em produção.
4. Tratar rejeições CORS explicitamente como 403.
5. Criar testes de integração para acesso anônimo, acesso entre organizações, RBAC e rota `/cadastro`.
6. Fazer uma revisão visual manual ou automatizada em navegador real para responsividade, navegação por teclado, modais e wizard.
