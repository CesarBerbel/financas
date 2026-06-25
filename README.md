# Finanças

Sistema de gestão financeira pessoal e empresarial multiperfil e multimoeda.

## Rodar localmente no Windows PowerShell

```powershell
Copy-Item .env.example .env
pnpm install
docker compose up -d
pnpm prisma:generate
pnpm prisma:migrate:dev --name fase_0_foundation
pnpm seed
pnpm --filter api start:dev
pnpm --filter web dev
```

API: http://localhost:3001  
Web: http://localhost:3000

## Validação

```powershell
pnpm prisma:validate
pnpm lint
pnpm typecheck
pnpm build
pnpm test
```

## Branch, commit e PR

A Fase 0 pertence à Release 1.

```powershell
git checkout main
git pull origin main
git checkout -b release/01-mvp-operacional
```

```powershell
git add .
git commit -m "feat(finance): concluir fase 0 fundacao tecnica"
```

O PR para `main` deve ser aberto somente no final da Release 1, após concluir as fases 0, 1, 2 e 3.

```powershell
git push -u origin release/01-mvp-operacional
gh pr create --base main --head release/01-mvp-operacional --title "Release 1 - MVP Operacional" --body "Entrega das fases 0, 1, 2 e 3 do sistema financeiro."
```

## Correção Fase 1 - Perfis financeiros

A tela `/profiles` agora permite adicionar e editar perfis financeiros. Perfis ativos são carregados no formulário de criação de contas em `/accounts`.

Aplicar migration:

```powershell
pnpm prisma:migrate:dev --name fase_1_profiles_crud_fix
```


## Correção adicional de inicialização da API

O script `pnpm --filter api start` foi alterado para `nest start`, evitando que o desenvolvimento tente executar `apps/api/dist/main` quando o build ainda não existe. Use `pnpm --filter api start:dev` durante desenvolvimento e `pnpm --filter api start:prod` somente para produção.


## Execução limpa obrigatória no Windows PowerShell

Use estes comandos quando houver erro de `dist/main`, rota antiga ou módulo antigo carregado:

```powershell
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Remove-Item -Recurse -Force .\apps\api\dist -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .\apps\web\.next -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .\node_modules -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .\apps\api\node_modules -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .\apps\web\node_modules -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .\packages\shared\node_modules -ErrorAction SilentlyContinue

pnpm install
pnpm prisma:generate
pnpm prisma:migrate:dev
pnpm --filter api start:dev
pnpm --filter web dev
```

A API deve subir em `http://localhost:3001/api` e o frontend deve usar `NEXT_PUBLIC_API_URL=http://localhost:3001/api`.

## Correção runtime sem dist/main

A API em desenvolvimento não depende mais de `apps/api/dist/main`. Os scripts `start`, `dev` e `start:dev` agora executam `src/main.ts` diretamente com `ts-node` e `tsconfig-paths`. O build de produção continua gerando `dist/main.js` apenas para `start:prod`.

Comandos recomendados no Windows PowerShell:

```powershell
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Remove-Item -Recurse -Force .\apps\api\dist -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .\apps\web\.next -ErrorAction SilentlyContinue
pnpm install
pnpm prisma:generate
pnpm --filter api start:dev
pnpm --filter web dev
```

## Ajuste Fase 1 - Dashboard, contas e perfis

O dashboard da Fase 1 foi simplificado para exibir apenas quantidade de contas e saldo consolidado. A gestão detalhada ficou nas páginas próprias:

- `/accounts`: lista de contas em cards, botão para adicionar nova conta e ações de editar, arquivar e fechar.
- `/profiles`: lista de perfis em cards, botão para adicionar perfil e ações de editar e arquivar.

Não houve migration neste ajuste.

## Ajuste visual da Fase 1

As listas de contas e perfis agora usam cards compactos em grid responsivo, com até 4 cards por linha em telas largas, tipografia menor e botões de ação reduzidos.

## Ajuste Fase 1 - suporte a dólar americano

A Fase 1 agora permite criar perfis financeiros e contas em USD. A moeda foi adicionada ao seed e também a uma migration de dados para ambientes que já tinham o banco criado.

Aplicar migration/seed:

```powershell
pnpm prisma:generate
pnpm prisma:migrate:dev
pnpm seed
```

Depois rode:

```powershell
pnpm --filter api start:dev
pnpm --filter web dev
```


## Ajuste Fase 1 - Empresarial USA

O sistema agora permite criar perfis do tipo Empresarial USA, com moeda base USD. Para aplicar a atualização:

```powershell
pnpm prisma:generate
pnpm prisma:migrate:dev
pnpm --filter api start:dev
pnpm --filter web dev
```

### Ajuste visual da Fase 1 - contas por perfil

A página de contas agrupa os cards por perfil financeiro. Cada grupo tem cabeçalho com resumo, saldo por moeda e controle para colapsar ou expandir a lista de contas daquele perfil.

## Ajuste Fase 1 - regras de status das contas

A listagem de contas agora respeita as regras de status solicitadas:

- contas arquivadas ficam ocultas por padrão;
- o checkbox `Mostrar arquivadas` exibe as contas arquivadas quando necessário;
- contas arquivadas e fechadas não podem ser editadas;
- contas arquivadas não podem ser fechadas diretamente;
- contas arquivadas podem ser desarquivadas para voltar ao status ativa;
- contas com saldo diferente de zero não podem ser arquivadas nem fechadas;
- grupos por perfil usam apenas setas para expandir/recolher;
- a listagem não usa mais painel branco por trás dos grupos de cards;
- o botão `Atualizar perfis` foi removido.

Sem migration neste ajuste.

Observação: o resumo do dashboard agora considera apenas contas ativas.

## Ajuste Fase 1 - contas fechadas fora da listagem

Contas fechadas não aparecem mais em nenhuma lista operacional de contas, mesmo quando o checkbox `Mostrar arquivadas` estiver acionado. Elas permanecem salvas no banco para relatórios futuros.

Sem migration neste ajuste.


## Fase 2 - Transações Financeiras

A Fase 2 adiciona a tela `/transactions` e a API `/api/transactions` para registrar receitas, despesas, transferências de mesma moeda e ajustes de saldo.

### Rodar após aplicar a Fase 2

```powershell
pnpm install
pnpm prisma:generate
pnpm prisma:migrate:dev
pnpm --filter api start:dev
pnpm --filter web dev
```

### Validar

```powershell
pnpm prisma:validate
pnpm --filter api typecheck
pnpm --filter web typecheck
pnpm --filter api test
pnpm --filter web build
```

## Ajuste UX - máscara monetária e fechamento de conta

Os campos monetários de contas e transações agora exibem máscara com símbolo da moeda e placeholder no formato `símbolo da moeda 0,00`. O fechamento de conta exige confirmação explícita antes de chamar a API.

Sem migration neste ajuste.

## Fase 3 - Categorias e Organização

A Fase 3 adiciona categorias persistidas, subcategorias, tags livres em transações e relatório por categoria. Categorias personalizadas podem ser removidas quando não possuem vínculos; categorias padrão, categorias em uso e categorias com subcategorias exibem mensagem amigável explicando o bloqueio.

Novas áreas:

- `/categories`: gestão de categorias, subcategorias e relatório por categoria.
- `/transactions`: seleção de categoria persistida, tags livres e filtros por categoria/tag.

Há migration Prisma nova:

```powershell
pnpm prisma:generate
pnpm prisma:migrate:dev
```

Depois rode:

```powershell
pnpm --filter api start:dev
pnpm --filter web dev
```

Validação recomendada:

```powershell
pnpm prisma:validate
pnpm --filter api typecheck
pnpm --filter web typecheck
pnpm --filter api test
pnpm --filter web build
```

Commit de fim da Fase 3 na branch da Release 1:

```powershell
git add .
git commit -m "feat(finance): concluir fase 3 categorias e organizacao"
```

Como a Release 1 inclui Fases 0, 1, 2 e 3, após homologar esta fase abra o PR para `main`:

```powershell
git push -u origin release/01-mvp-operacional
gh pr create --base main --head release/01-mvp-operacional --title "Release 1 - MVP Operacional" --body "Entrega das fases 0, 1, 2 e 3 do sistema financeiro."
```

## Ajuste UX - nova categoria inline em transações

No formulário de transações, o atalho antigo `Gerir categorias` foi removido da área de ações. O campo Categoria agora possui o botão `+ nova categoria`, que abre um modal para criar uma categoria ou subcategoria no contexto do perfil financeiro selecionado e já selecionar a nova categoria no lançamento.

Sem migration neste ajuste.

## Ajuste UX - formulários de criação e edição em modal

As telas operacionais agora mantêm suas listas como contexto e abrem os formulários de criação/edição em modal para perfis financeiros, contas, categorias e transações. Filtros e relatórios permanecem inline por não serem formulários de criação/edição de entidades.

Sem migration neste ajuste.

## Hardening QA antes da Release 2

A Release 1 agora possui uma base de testes e CI antes do avanço para a Release 2.

Novos comandos principais:

```powershell
pnpm prisma:validate
pnpm prisma:generate
pnpm --filter @financas/shared build
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:e2e
pnpm build
```

Para rodar E2E local com banco separado:

```powershell
$env:DATABASE_URL="postgresql://financas:financas_test_pwd@localhost:5436/financas_test?schema=public"
docker compose -f docker-compose.test.yml up -d
pnpm prisma:migrate:deploy
pnpm seed
pnpm test:e2e
Remove-Item Env:DATABASE_URL
```

Para resetar apenas o banco de teste:

```powershell
# este comando apaga dados do banco de teste
$env:DATABASE_URL="postgresql://financas:financas_test_pwd@localhost:5436/financas_test?schema=public"
docker compose -f docker-compose.test.yml down -v

docker compose -f docker-compose.test.yml up -d
pnpm prisma:migrate:deploy
pnpm seed
pnpm test:e2e
Remove-Item Env:DATABASE_URL
```

A CI executa validação estática, testes unitários/componentes, build e E2E da API com PostgreSQL real.

Observação: o projeto ainda não tinha `pnpm-lock.yaml` versionado. A CI usa `pnpm install --no-frozen-lockfile`; após a primeira instalação local, versione o lockfile para permitir endurecer a CI com `--frozen-lockfile`.
