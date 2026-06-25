# Release 1 - Fase 2 - Transações Financeiras

## Objetivo

Implementar o registro operacional de movimentações financeiras manuais para receitas, despesas, transferências de mesma moeda e ajustes de saldo.

## O que foi implementado

- Modelo `Transaction` no Prisma.
- Enum `TransactionType` com `INCOME`, `EXPENSE`, `TRANSFER` e `ADJUSTMENT`.
- Auditoria para criação, edição e exclusão lógica de transações.
- API protegida `/api/transactions`.
- Filtros por perfil, conta, categoria e período.
- Criação de receita, despesa, transferência e ajuste.
- Edição de transações com reversão do impacto anterior e aplicação do novo impacto.
- Exclusão lógica de transação com reversão automática do saldo.
- Transferências permitidas apenas entre contas ativas da mesma moeda nesta fase.
- Tela `/transactions` com lista, filtros, formulário, edição e exclusão.
- Link de transações no dashboard e nas telas de contas/perfis.
- Categoria como texto livre provisório até a Fase 3.
- Testes unitários básicos de transações.

## Regras de negócio

- Receita aumenta saldo da conta.
- Despesa reduz saldo da conta.
- Ajuste altera o saldo pelo valor informado, positivo ou negativo.
- Transferência reduz saldo da conta de origem e aumenta saldo da conta de destino.
- Transferência entre moedas diferentes fica para a Fase 5.
- Apenas contas ativas podem receber lançamentos.
- Ao editar uma transação, o efeito antigo é revertido e o novo efeito é aplicado.
- Ao excluir uma transação, ela é marcada com `deletedAt` e o saldo é revertido.

## Migration

Há migration nova:

```text
prisma/migrations/20260625070000_fase_2_transactions/migration.sql
```

## Rodar

```powershell
pnpm install
pnpm prisma:generate
pnpm prisma:migrate:dev
pnpm --filter api start:dev
pnpm --filter web dev
```

## Validar

```powershell
pnpm prisma:validate
pnpm --filter api typecheck
pnpm --filter web typecheck
pnpm --filter api test
pnpm --filter web build
```

## Commit da Fase 2

```powershell
git add .
git commit -m "feat(finance): concluir fase 2 transacoes financeiras"
```
