# Release 1 — Fase 1: Contas Financeiras

## Objetivo

Permitir que o usuário cadastre, visualize, arquive e feche contas financeiras por perfil, moeda e tipo de conta.

## Escopo implementado

- Modelo Prisma `Account`.
- Enums `AccountType` e `AccountStatus`.
- Novas ações de auditoria para contas.
- API protegida por JWT para contas:
  - `GET /accounts`
  - `GET /accounts/summary`
  - `POST /accounts`
  - `PATCH /accounts/:id`
  - `POST /accounts/:id/archive`
  - `POST /accounts/:id/close`
- Isolamento por usuário através do vínculo com `FinancialProfile`.
- Tela `/accounts` para cadastro e gestão de contas.
- Dashboard inicial com resumo por moeda e perfil.
- Testes unitários de isolamento e consolidação de saldos.

## Branch da release

```powershell
git checkout main
git pull origin main
git checkout -b release/01-mvp-operacional
```

## Migration

Esta fase possui migration Prisma nova.

```powershell
pnpm prisma:generate
pnpm prisma:migrate:dev --name fase_1_accounts
```

## Execução local

```powershell
pnpm install
docker compose up -d
pnpm prisma:generate
pnpm prisma:migrate:dev --name fase_1_accounts
pnpm seed
pnpm --filter api start:dev
pnpm --filter web dev
```

## Validação automatizada

```powershell
pnpm prisma:validate
pnpm --filter api typecheck
pnpm --filter web typecheck
pnpm --filter api test
pnpm build
```

## Validação manual

1. Criar usuário ou fazer login.
2. Confirmar redirecionamento para `/dashboard`.
3. Abrir `/accounts`.
4. Criar conta EUR no perfil Pessoal Portugal.
5. Criar conta BRL no perfil Pessoal Brasil.
6. Confirmar que o dashboard mostra saldos por moeda.
7. Confirmar que o dashboard mostra saldos por perfil.
8. Arquivar uma conta ativa.
9. Fechar uma conta ativa ou arquivada.
10. Confirmar que contas de outro usuário não aparecem.

## Commit da fase

```powershell
git add .
git commit -m "feat(finance): concluir fase 1 contas financeiras"
```

## Riscos e observações

- A Fase 1 ainda não recalcula saldo por transações, pois transações entram na Fase 2.
- Conta fechada não pode ser reaberta nesta fase para evitar inconsistência operacional.
- Não há reset destrutivo de banco necessário.
