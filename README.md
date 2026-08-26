# CRM RS LOG

CRM de prospecção ativa da RS LOG (transportes/logística), construído como aplicação web full-stack:

- **Frontend:** React + Vite + TypeScript + Tailwind CSS
- **Backend/API:** Cloudflare Workers (framework [Hono](https://hono.dev))
- **Banco de dados:** Cloudflare D1 (SQLite)
- **Hospedagem:** Cloudflare Workers com Static Assets (frontend e API no mesmo Worker)
- **Autenticação:** Cloudflare Access
- **Controle de versão / CI:** GitHub + Cloudflare Workers Builds

Este repositório corresponde às **Etapas 1, 2 e 3** do projeto — as três etapas planejadas estão concluídas:

- **Etapa 1:** estrutura do projeto, banco D1 completo, cadastro de empresas e contatos, funil Kanban, histórico, atividades/calendário e armazenamento real no D1 — nada de dados simulados depois que o banco está conectado.
- **Etapa 2:** cotações (múltiplas por oportunidade, com itens), cadências de prospecção (modelos reutilizáveis aplicados às oportunidades, gerando atividades automaticamente), área de nutrição de leads (com retomada e preservação total do histórico), importação de planilhas (XLSX/CSV com mapeamento de colunas, prévia e confirmação), exportação (CSV/XLSX/backup JSON) e o dashboard completo com todos os indicadores calculados via consultas reais ao D1.
- **Etapa 3:** verificação criptográfica do JWT do Cloudflare Access (defesa em profundidade), tela de gestão de usuários/equipe, trilha de auditoria completa com filtros, cabeçalhos de segurança HTTP, testes adicionais e refinamentos finais de navegação.

---

## Sumário

- [Arquitetura e estrutura de pastas](#arquitetura-e-estrutura-de-pastas)
- [Pré-requisitos](#pré-requisitos)
- [Desenvolvimento local](#desenvolvimento-local)
- [Criar o banco de dados D1](#criar-o-banco-de-dados-d1)
- [Aplicar as migrations](#aplicar-as-migrations)
- [Adicionar novos vendedores](#adicionar-novos-vendedores)
- [Funcionalidades da Etapa 2](#funcionalidades-da-etapa-2)
- [Funcionalidades da Etapa 3](#funcionalidades-da-etapa-3)
- [Testes automatizados](#testes-automatizados)
- [Publicar em produção](#publicar-em-produção)
- [Conectar o GitHub ao Cloudflare (Workers Builds)](#conectar-o-github-ao-cloudflare-workers-builds)
- [Configurar o Cloudflare Access](#configurar-o-cloudflare-access)
- [Segurança](#segurança)
- [Status do projeto](#status-do-projeto)

---

## Arquitetura e estrutura de pastas

```
crm-rslog/
├── src/                        # Frontend (React + Vite + TS + Tailwind)
│   ├── components/
│   │   ├── Layout/              # Sidebar recolhível, Topbar, AuthGate
│   │   ├── Kanban/               # Board, coluna e card do funil (drag-and-drop)
│   │   ├── Companies/            # Lista e formulário de empresas
│   │   ├── Contacts/             # Lista e formulário de contatos
│   │   ├── Activities/           # Formulário, badge de alerta, modal de nova atividade
│   │   ├── Opportunities/        # Drawer de detalhe, formulário, histórico, motivo de perda,
│   │   │                         # painel de cadência aplicada
│   │   ├── Quotes/               # Formulário, badge de situação, editor de itens, painel de cotações
│   │   ├── Cadences/             # Formulário de modelo de cadência (passos editáveis)
│   │   └── common/               # Button, Input, Select, Modal, ConfirmDialog etc.
│   ├── pages/                   # Dashboard, Funil, Empresas, Calendário, Cadências,
│   │                             # Nutrição, Importar/Exportar
│   ├── hooks/                   # React Query hooks por domínio (companies, opportunities,
│   │                             # quotes, cadences, nutrition, dashboard, import/export...)
│   └── lib/                     # Cliente HTTP, tipos, formatação, validação de formulários,
│                                 # leitura de planilhas (spreadsheet.ts), campos de importação
├── worker/                      # Backend (Cloudflare Worker)
│   ├── index.ts                  # Entry point, monta as rotas Hono
│   ├── auth.ts                   # Identificação do usuário via Cloudflare Access
│   ├── utils.ts                  # IDs, datas, paginação, cálculo de alerta, audit_log
│   ├── import.ts                 # Lógica de importação (linha a linha, dedupe, resolução de referências)
│   ├── export.ts                 # Geração de CSV/XLSX a partir de linhas do D1
│   ├── validation/schemas.ts     # Validação (Zod) de todas as rotas
│   └── routes/                   # companies, contacts, pipeline-stages, opportunities,
│                                  # activities, users, loss-reasons, quotes, cadences,
│                                  # nutrition, dashboard, importExport
├── migrations/                  # SQL versionado do D1
│   ├── 0001_init.sql              # Schema completo (17 tabelas)
│   └── 0002_seed_data.sql         # Dados fictícios para demonstração
├── tests/                       # Testes automatizados (Vitest)
│   ├── worker/                    # Regras de negócio e validação do backend
│   └── frontend/                  # Utilitários, validação de formulários, componentes
├── wrangler.jsonc                # Configuração do Worker (D1, Static Assets, variáveis)
├── package.json
└── .dev.vars.example             # Modelo de variáveis de ambiente locais (sem segredos)
```

### Como a API e o frontend convivem no mesmo Worker

O `wrangler.jsonc` usa `assets.run_worker_first: true`: **toda** requisição passa primeiro pelo Worker (`worker/index.ts`). Rotas `/api/*` são tratadas pelo Hono; qualquer outra rota é repassada para o binding `ASSETS`, que serve o frontend compilado (`dist/`) com fallback de SPA automático.

### Modelo de dados (D1)

A migration `0001_init.sql` cria as 17 tabelas do domínio completo do CRM: `users`, `companies`, `contacts`, `opportunities`, `pipeline_stages`, `activities`, `activity_history`, `notes`, `quotes`, `quote_items`, `cadence_templates`, `cadence_steps`, `lead_cadences`, `nutrition_leads`, `loss_reasons`, `import_history` e `audit_log` — com relacionamentos (chaves estrangeiras), índices e `created_at`/`updated_at`/`created_by`/`updated_by` em todas as tabelas relevantes. Isso evita retrabalho de schema nas próximas etapas.

Com a Etapa 2 concluída, todas as 17 tabelas estão em uso pela API e pela interface: além das já usadas na Etapa 1 (`companies`, `contacts`, `pipeline_stages`, `opportunities`, `activities`, `activity_history`, `notes`, `loss_reasons`, `audit_log`, `users`), agora também `quotes`, `quote_items`, `cadence_templates`, `cadence_steps`, `lead_cadences`, `nutrition_leads` e `import_history`.

---

## Pré-requisitos

- **Node.js 20+** e **npm**
- Uma conta [Cloudflare](https://dash.cloudflare.com) (plano gratuito é suficiente para começar)
- `wrangler` (instalado como dependência do projeto — não precisa instalar globalmente)

Autentique o Wrangler com sua conta Cloudflare antes de criar recursos:

```bash
npx wrangler login
```

---

## Desenvolvimento local

```bash
npm install

# Copie o modelo de variáveis de ambiente locais (NUNCA versione o .dev.vars real)
cp .dev.vars.example .dev.vars
```

Como o Cloudflare Access não existe em `localhost`, o `.dev.vars` define `DEV_USER_EMAIL` — o backend usa esse e-mail para simular o usuário autenticado em desenvolvimento (veja `worker/auth.ts`). Ele precisa corresponder a um e-mail já cadastrado na tabela `users` (o seed cria `admin@rslog.com.br`, `carlos.lima@rslog.com.br` e `fernanda.ramos@rslog.com.br`).

Rode frontend e backend juntos:

```bash
npm run db:migrate:local   # cria o banco D1 local (SQLite) e aplica o schema + seed
npm run dev:all            # sobe o Vite (porta 5173) e o Worker (porta 8787) juntos
```

Acesse **http://localhost:5173**. O Vite faz proxy de `/api/*` para o Worker local (veja `vite.config.ts`), então o frontend fala com a API como se fosse a mesma origem — igual à produção.

Se preferir rodar cada parte separadamente: `npm run dev` (só o frontend) e `npm run dev:worker` (só o Worker, em outro terminal).

---

## Criar o banco de dados D1

1. Crie o banco na sua conta Cloudflare:

   ```bash
   npm run db:create
   ```

2. O comando retorna um bloco com o `database_id`. Copie esse valor e cole em `wrangler.jsonc`, substituindo `SUBSTITUA_PELO_ID_DO_BANCO_D1`:

   ```jsonc
   "d1_databases": [
     {
       "binding": "DB",
       "database_name": "crm-rslog-db",
       "database_id": "cole-o-id-aqui",
       "migrations_dir": "migrations"
     }
   ]
   ```

   Esse ID não é secreto (é só um identificador de recurso), mas ele é específico da sua conta — por isso não vem preenchido no repositório.

---

## Aplicar as migrations

```bash
# Ambiente local (arquivo SQLite gerenciado pelo Wrangler/Miniflare)
npm run db:migrate:local

# Banco remoto (produção), depois de criar o banco e configurar o database_id
npm run db:migrate:remote
```

Os comandos acima já aplicam **schema + dados fictícios**, pois `0002_seed_data.sql` é uma migration como outra qualquer. Se quiser popular novamente sem recriar o schema (por exemplo, depois de limpar as tabelas manualmente), rode só o seed:

```bash
npm run db:seed:local
npm run db:seed:remote
```

> As datas das atividades de exemplo são calculadas em relação ao momento em que a migration roda (`now`, `now -2 days`, `now +3 days`...), então os alertas de atraso do calendário sempre aparecem coerentes, não importa quando você aplicar o seed.

---

## Adicionar novos vendedores

Desde a Etapa 3, o dia a dia de cadastrar/editar/desativar usuários é feito pela própria tela **Usuários** (menu lateral, só visível para administradores). Para autorizar um novo vendedor:

1. Ele precisa primeiro existir como usuário autorizado no **Cloudflare Access** (veja a seção abaixo) — isso controla quem consegue sequer chegar ao Worker.
2. Um administrador cadastra o mesmo e-mail em **Usuários → Novo usuário**, definindo nome e papel (`admin` ou `vendedor`). A tela também permite editar nome/e-mail/papel e desativar (`active = 0`) alguém que saiu da equipe — usuários nunca são excluídos de verdade, pois oportunidades, atividades, notas e o `audit_log` referenciam o `id` dele.

Sem as duas etapas, o acesso é negado: o Access bloqueia e-mails não autorizados no edge, e o backend também recusa (403) qualquer e-mail que não exista como usuário ativo — mesmo que, por algum motivo, ele passasse pelo Access.

> **Bootstrap do primeiro administrador:** como a tela de Usuários só é acessível a quem já é `admin`, o **primeiro** administrador do sistema (ou a recuperação de um ambiente sem nenhum admin ativo) ainda precisa ser cadastrado direto no banco:
>
> ```bash
> npx wrangler d1 execute crm-rslog-db --remote --command \
>   "INSERT INTO users (id, email, name, role, active) VALUES ('usr_admin', 'admin@rslog.com.br', 'Nome do Administrador', 'admin', 1);"
> ```
>
> A partir daí, todo o resto pode ser feito pela própria interface.

---

## Funcionalidades da Etapa 2

### Cotações

Dentro do detalhe de cada oportunidade (`OpportunityDrawer`), a seção **Cotações** permite cadastrar múltiplas cotações — número gerado automaticamente (`AAAA-NNNN`), origem/destino, tipo de carga/veículo, valor, custo estimado (a margem é calculada automaticamente pelo backend), validade e observações. Cada cotação pode ter itens de linha (descrição, quantidade, valor unitário — total calculado no backend) e uma situação (`rascunho → enviada → aprovada/recusada/expirada`); marcar como **recusada** exige informar o motivo, assim como a perda de uma oportunidade.

### Cadências de prospecção

Em **Cadências** (menu lateral), é possível criar modelos reutilizáveis com uma sequência de passos (ligação, e-mail, WhatsApp, reunião, follow-up), cada um com um número de dias após o início da cadência. Dentro de uma oportunidade, aplicar um modelo gera automaticamente as atividades correspondentes no calendário, respeitando os intervalos configurados. Uma oportunidade só pode ter uma cadência ativa por vez; cancelar interrompe a geração de novos passos sem apagar o que já foi criado.

### Nutrição de leads

Uma oportunidade movida para a etapa marcada como "de nutrição" no funil (por padrão, "Nutrição") entra automaticamente na tela **Nutrição**, onde é possível registrar o motivo e uma data sugerida para retomar o contato. Retomar um lead pede a etapa de destino no funil e move a oportunidade de volta para `aberta` — **todo o histórico, notas, cotações e atividades anteriores são preservados**, nada é apagado nesse fluxo.

### Importação e exportação

A tela **Importar/Exportar** cobre:

- **Importação:** envie uma planilha `.xlsx`/`.xls`/`.csv`, escolha o que está importando (empresas, contatos ou oportunidades), mapeie as colunas da planilha para os campos do CRM (a tela tenta adivinhar o mapeamento automaticamente pelos nomes das colunas) e gere uma **prévia** — que mostra, linha a linha, o que será criado, atualizado ou rejeitado (com o motivo do erro), sem gravar nada no banco. A confirmação só grava depois que a prévia foi revisada. Duplicidade é detectada por CNPJ (empresas), e-mail (contatos) ou nome dentro da empresa/etapa (oportunidades) — registros equivalentes viram atualização em vez de duplicata. Toda importação confirmada fica registrada em `import_history`.
- **Exportação:** empresas, contatos, oportunidades, atividades, cotações, leads em nutrição (em CSV ou XLSX) e um backup completo em JSON de todas as tabelas de negócio.

> **Nota sobre a biblioteca de planilhas:** tanto a leitura no navegador (`src/lib/spreadsheet.ts`) quanto a geração no backend (`worker/export.ts`) usam `@e965/xlsx` em vez do pacote `xlsx` padrão do npm — o pacote `xlsx` está parado na v0.18.5 com CVEs conhecidos sem correção publicada ali (a SheetJS move as correções de segurança para sua própria CDN desde a v0.19). `@e965/xlsx` republica o mesmo código oficial já corrigido através do registro npm normal. Veja o comentário no topo de `worker/export.ts` para mais detalhes e a alternativa de instalar direto da CDN da SheetJS, se preferir.

### Dashboard completo

O dashboard (tela inicial) calcula todos os indicadores com consultas reais ao D1 a cada carregamento: totais de leads, novos leads no mês, contatos realizados, atividades atrasadas/do dia, leads qualificados, cotações solicitadas/enviadas e valor total cotado, vendas concluídas e receita, ticket médio, tempo médio de fechamento, valor e distribuição do funil por etapa, previsão de receita, vendas e atividades por vendedor, melhores origens de lead, motivos de perda e negócios parados (sem contato há mais de 10 dias). As definições de negócio usadas para os indicadores mais ambíguos (por exemplo, o que conta como "lead qualificado" num funil com etapas customizáveis, ou como a previsão de receita é ponderada por etapa) estão comentadas em `worker/routes/dashboard.ts` — são aproximações pragmáticas, não um modelo estatístico.

---

## Funcionalidades da Etapa 3

### Verificação criptográfica do JWT do Cloudflare Access

Além de confiar no cabeçalho `Cf-Access-Authenticated-User-Email` (já protegido pelo Access no edge), o Worker pode validar a assinatura do JWT enviado em `Cf-Access-Jwt-Assertion` contra o JWKS público do team domain — emissor, audiência e expiração inclusive (`worker/accessJwt.ts`, usando a lib [`jose`](https://github.com/panva/jose), compatível com o runtime de Workers). Essa checagem extra liga sozinha assim que `CF_ACCESS_TEAM_DOMAIN` e `CF_ACCESS_AUD` forem preenchidos com valores reais em `wrangler.jsonc` (veja [Configurar o Cloudflare Access](#configurar-o-cloudflare-access)); enquanto ficarem com os valores de exemplo, o CRM segue funcionando normalmente só com o cabeçalho de e-mail.

### Gestão de usuários e equipe

A tela **Usuários** (visível só para administradores) lista todos os usuários — ativos e inativos —, permite criar novos, editar nome/e-mail/papel e ativar/desativar. Duas proteções em vigor: e-mail duplicado é rejeitado (`409`), e um administrador não pode remover o próprio papel de admin nem se desativar (evita que a equipe fique sem nenhum admin ativo por engano). Toda criação/edição gera uma linha no `audit_log`.

### Trilha de auditoria

A tela **Auditoria** (também restrita a administradores) consulta o `audit_log` com filtros por tipo de registro, usuário responsável e período, mostrando quem alterou o quê, quando, e o valor antigo/novo de cada campo alterado — cobrindo empresas, contatos, oportunidades, atividades, cotações, cadências, nutrição de leads e os próprios usuários. A rota (`GET /api/audit-log`) é paginada e somente leitura.

### Cabeçalhos de segurança HTTP

Todo o Worker (API e frontend estático) responde com um conjunto de cabeçalhos de segurança — `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` e `Permissions-Policy` (`worker/securityHeaders.ts`) — como reforço adicional além do perímetro já garantido pelo Cloudflare Access.

---

## Testes automatizados

```bash
npm run test         # roda uma vez
npm run test:watch   # modo watch
```

A suíte cobre as regras de negócio e validações mais críticas:

- **`tests/worker/utils.test.ts`** — cálculo do alerta de atividade (atrasada/hoje/futura/concluída e dias de atraso), diff de campos para o `audit_log`, normalização de strings vazias e paginação.
- **`tests/worker/schemas.test.ts`** — validação (Zod) das rotas de empresas, contatos, atividades, troca de etapa e reordenação do funil.
- **`tests/worker/quotes.test.ts`** — cálculo da margem estimada da cotação (valor − custo), incluindo arredondamento e margem negativa.
- **`tests/worker/cadences.test.ts`** — detecção de ordens de passo duplicadas num modelo de cadência.
- **`tests/worker/import.test.ts`** — coerção de texto/número/booleano vindos da planilha (incluindo números no padrão brasileiro), e o resumo agregado (criar/atualizar/erro) de uma importação.
- **`tests/worker/export.test.ts`** — geração de CSV: escaping de vírgula, aspas e valores nulos.
- **`tests/frontend/utils.test.ts`** — formatação de moeda/data e conversão de valores monetários no padrão brasileiro (ex.: `"18.500,50"` → `18500.5`).
- **`tests/frontend/formSchemas.test.ts`** — validação client-side dos formulários, incluindo cotações, itens de cotação, modelos de cadência e nutrição.
- **`tests/frontend/spreadsheet.test.ts`** — mapeamento automático de colunas da planilha para os campos do CRM e aplicação do mapeamento escolhido pelo usuário.
- **`tests/frontend/ActivityBadge.test.tsx`** / **`QuoteStatusBadge.test.tsx`** — renderização dos selos de alerta e de situação da cotação (cores/rótulos).
- **`tests/worker/accessJwt.test.ts`** — detecção de quando a verificação do JWT do Access está de fato configurada (vs. valores de exemplo do `wrangler.jsonc`) e recusa de tokens malformados sem lançar exceção.
- **`tests/worker/securityHeaders.test.ts`** — presença dos cabeçalhos de segurança em respostas normais e em respostas de erro (404).
- Schemas de usuário (`userCreateSchema`/`userUpdateSchema`) cobertos em **`tests/worker/schemas.test.ts`**.

Outras verificações úteis antes de um deploy:

```bash
npm run typecheck   # TypeScript (frontend + worker)
npm run build       # build de produção do frontend (falha se houver erro de tipo/bundling)
```

---

## Publicar em produção

```bash
npm run deploy
```

Esse comando builda o frontend (`vite build` → `dist/`) e publica o Worker (com os Static Assets e os bindings configurados em `wrangler.jsonc`) via `wrangler deploy`. Não esqueça de:

1. Ter criado o banco D1 e preenchido o `database_id` (veja acima).
2. Ter aplicado as migrations no banco remoto (`npm run db:migrate:remote`).
3. Ter configurado o Cloudflare Access na frente do domínio (veja abaixo) **antes** de considerar o deploy "pronto para uso" — sem isso, o CRM fica exposto.

---

## Conectar o GitHub ao Cloudflare (Workers Builds)

Isso permite que todo `push`/merge na branch principal publique automaticamente uma nova versão.

1. Suba este repositório para o GitHub (`git push` para um repositório novo).
2. No [dashboard da Cloudflare](https://dash.cloudflare.com), vá em **Workers & Pages → Create → Workers → Connect to Git** (ou, num Worker já existente, na aba **Settings → Builds**).
3. Selecione o repositório e a branch de produção (ex.: `main`).
4. Configure o build:
   - **Build command:** `npm run build`
   - **Deploy command:** `npx wrangler deploy`
   - **Root directory:** raiz do repositório (onde está o `wrangler.jsonc`)
5. Em **Environment variables / Secrets** do build, você **não** precisa recriar `vars` que já estão em `wrangler.jsonc` (como `ENVIRONMENT`, `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`) — eles são lidos do próprio arquivo. Use essa área apenas se precisar de segredos reais no futuro (ex.: chaves de API de terceiros), via `wrangler secret put NOME_DA_VARIAVEL`.
6. Salve. A partir daí, cada push relevante dispara um novo build e deploy automaticamente.

---

## Configurar o Cloudflare Access

O CRM **não pode ficar aberto ao público** — o Access protege o domínio inteiro antes de qualquer requisição chegar ao Worker.

1. No dashboard, acesse **Zero Trust → Access → Applications → Add an application → Self-hosted**.
2. Aponte a aplicação para o domínio/subdomínio onde o Worker está publicado (ex.: `crm.rslog.com.br` ou o subdomínio padrão `*.workers.dev`).
3. Em **Policies**, crie uma política do tipo *Allow* com **Include → Emails** e liste, um por um, os e-mails autorizados a acessar (comece só com os e-mails que já devem ter acesso na Etapa 1). Isso garante que **somente e-mails expressamente autorizados** entrem — exatamente o modelo pedido.
4. Depois de salvar, copie o **Application Audience (AUD) Tag** da aplicação e o **Team Domain** (algo como `sua-empresa.cloudflareaccess.com`) e preencha em `wrangler.jsonc`:

   ```jsonc
   "vars": {
     "CF_ACCESS_TEAM_DOMAIN": "sua-empresa.cloudflareaccess.com",
     "CF_ACCESS_AUD": "o-aud-tag-da-aplicacao"
   }
   ```

5. Para liberar um novo vendedor futuramente, basta adicionar o e-mail dele na política do Access **e** cadastrá-lo na tabela `users` (veja [Adicionar novos vendedores](#adicionar-novos-vendedores)).

> O backend identifica o usuário autenticado pelo cabeçalho `Cf-Access-Authenticated-User-Email`, que o Access injeta depois de validar o login — o Worker nunca fica acessível sem passar por essa validação em produção. Desde a Etapa 3, quando `CF_ACCESS_TEAM_DOMAIN`/`CF_ACCESS_AUD` são preenchidos como acima, o Worker também valida a assinatura do JWT do Access (`Cf-Access-Jwt-Assertion`) contra o JWKS do team domain — ver [Verificação criptográfica do JWT do Cloudflare Access](#verificação-criptográfica-do-jwt-do-cloudflare-access).

---

## Segurança

- Nenhum segredo, token ou credencial está neste repositório. `.dev.vars` (valores reais locais) e `.wrangler/` estão no `.gitignore`; apenas `.dev.vars.example` (sem valores sensíveis) é versionado.
- Toda validação relevante acontece **também no backend** (`worker/validation/schemas.ts`), mesmo já existindo validação no frontend — o backend nunca confia apenas no que o cliente envia.
- Toda alteração de etapa no funil grava simultaneamente em `activity_history` (linha do tempo do card) e em `audit_log` (trilha de auditoria com usuário, campo, valor antigo e novo) — consultável na tela **Auditoria**.
- Operações destrutivas (excluir empresa, contato, oportunidade, atividade) exigem confirmação explícita no frontend (`ConfirmDialog`) e, no backend, empresas/etapas com registros vinculados não podem ser excluídas sem antes desvincular os dados (retorna `409`). Usuários não são excluídos, apenas desativados, para preservar essas referências.
- Rotas administrativas (`/api/users`, `/api/audit-log`) exigem papel `admin` (`requireAdmin`, `worker/auth.ts`) — um vendedor autenticado recebe `403` mesmo que tente acessá-las diretamente pela API.
- Defesa em profundidade adicional: verificação opcional do JWT do Access (veja acima) e cabeçalhos de segurança HTTP (`Content-Security-Policy`, `X-Frame-Options` etc.) em toda resposta do Worker.

---

## Status do projeto

As três etapas planejadas estão concluídas — veja [Funcionalidades da Etapa 2](#funcionalidades-da-etapa-2) e [Funcionalidades da Etapa 3](#funcionalidades-da-etapa-3) acima para o detalhe de cada entrega. Ideias para uma eventual "Etapa 4", não solicitadas até o momento: notificações por e-mail/WhatsApp de atividades atrasadas, anexos de arquivo em cotações (o binding R2 comentado em `wrangler.jsonc` já prevê isso), relatórios exportáveis em PDF e testes end-to-end de navegador (Playwright) cobrindo os fluxos completos de tela.
