# QA - Release 1 MVP Operacional

## Objetivo

Criar uma base de validação automatizada antes da Release 2, cobrindo os fluxos críticos já entregues nas Fases 0, 1, 2 e 3.

## Escopo automatizado

### Gates estáticos

- Validação do schema Prisma.
- Geração do Prisma Client.
- Typecheck de todos os pacotes do monorepo.
- Build de `packages/shared`, `apps/api` e `apps/web`.

### Testes unitários/API

- Serviços de perfis financeiros.
- Serviços de contas.
- Serviços de transações.
- Serviços de categorias.
- Regressões de saldo, categoria, tags, isolamento por usuário e regras de remoção.

### Testes de componente Web

- Formulário de transação abre em modal.
- Atalho antigo `Gerir categorias` não aparece mais no formulário de transações.
- Botão `+ nova categoria` abre modal empilhado de criação de categoria.
- Criação inline usa a API de categorias e mantém feedback de sucesso.

### Testes API E2E com PostgreSQL real

- Endpoints protegidos bloqueiam acesso sem JWT.
- Cadastro cria os perfis padrão da Release 1.
- Contas ficam isoladas entre usuários autenticados.
- Fluxo crítico: criar conta, criar categoria, criar transação, filtrar por categoria/tag, atualizar saldo consolidado e gerar relatório por categoria.
- Payloads inválidos são rejeitados antes de persistir dados financeiros.

## Ambiente local de testes E2E

O ambiente de teste usa banco separado do banco de desenvolvimento:

```powershell
$env:DATABASE_URL="postgresql://financas:financas_test_pwd@localhost:5436/financas_test?schema=public"
docker compose -f docker-compose.test.yml up -d
pnpm prisma:generate
pnpm prisma:migrate:deploy
pnpm seed
pnpm test:e2e
Remove-Item Env:DATABASE_URL
```

Para reiniciar o banco de teste do zero, use somente quando puder apagar os dados de teste:

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

## Critérios de entrada para PR

- Branch atualizada com `release/01-mvp-operacional`.
- Dependências instaladas.
- Banco de teste disponível para E2E.
- `.env` local sem apontar para produção.

## Critérios de saída para Release 1

Todos os comandos devem passar localmente e na CI:

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

## Riscos residuais

- Ainda não há E2E browser completo com Playwright; a validação web atual cobre componentes e build.
- A CI usa `pnpm install --no-frozen-lockfile` porque o repositório ainda não possui `pnpm-lock.yaml` versionado. Após rodar `pnpm install`, o lockfile deve ser commitado para permitir `--frozen-lockfile` em uma próxima melhoria.
- Testes de concorrência e auditoria profunda ainda devem ser ampliados em releases futuras.
