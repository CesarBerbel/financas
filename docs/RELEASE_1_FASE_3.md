# Release 1 - Fase 3 - Categorias e Organização

## Objetivo

Organizar receitas e despesas por categorias, subcategorias e tags livres, mantendo separação por perfil financeiro e adicionando relatório por categoria.

## Entregas

- Modelo Prisma para `Category`, `Tag` e `TransactionTag`.
- Relação opcional entre `Transaction` e `Category`, preservando `categoryName` para compatibilidade com lançamentos existentes.
- Categorias padrão criadas automaticamente por perfil ativo:
  - Pessoal Brasil: Moradia, Alimentação, Transporte.
  - Pessoal Portugal: Moradia, Alimentação, Transporte, IVA, Segurança Social.
  - Empresarial Portugal: Contabilidade, Impostos, Software, IVA, Segurança Social.
  - Empresarial USA: Contabilidade, Impostos, Software.
- API autenticada `/api/categories` para listar, criar, editar e remover categorias personalizadas. Categorias padrão, categorias com subcategorias e categorias em uso retornam mensagem amigável quando a remoção não é permitida.
- API autenticada `/api/categories/report` para relatório por categoria, perfil e moeda.
- Tela `/categories` para gestão de categorias, subcategorias e relatório.
- Tela `/transactions` atualizada para selecionar categoria persistida, registrar tags livres e filtrar por categoria/tag.
- Auditoria para criação, edição e remoção de categorias e criação de tags.
- Testes unitários de serviço para categorias, incluindo regressão para bloqueio de remoção de categoria padrão, e regressão de transações com categoria/tags.

## Banco de dados

Há migration Prisma nova:

```powershell
pnpm prisma:migrate:dev
```

A migration adiciona tabelas e coluna opcional, sem remover dados existentes:

- `Category`
- `Tag`
- `TransactionTag`
- `Transaction.categoryId`
- novos valores no enum `AuditAction`

## Rodar após aplicar a Fase 3

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

## Critérios de aceite cobertos

- Categorias por perfil financeiro.
- Subcategorias por categoria principal.
- Tags livres em transações.
- Filtros por categoria e tag.
- Relatório por categoria com receitas, despesas, líquido e quantidade de lançamentos.
- Remoção de categorias personalizadas sem vínculos; bloqueio amigável para categorias padrão, categorias em uso ou com subcategorias.

## Ajuste UX - criação inline de categoria em transações

O formulário de transações não exibe mais o botão `Gerir categorias` na área de ações. A criação rápida agora fica contextual ao campo de categoria:

- botão `+ nova categoria` acima do select de categorias;
- modal acessível para criar categoria ou subcategoria sem sair do lançamento;
- categoria criada usando a API existente `/api/categories`;
- categoria criada é recarregada e selecionada automaticamente na transação atual;
- mensagens amigáveis para erro de validação, sessão expirada ou conflito de categoria duplicada.

Sem migration neste ajuste.

## Ajuste UX - formulários de criação e edição em modal

Todos os formulários de criação/edição das entidades atuais foram padronizados para abrir em modal:

- perfis financeiros;
- contas financeiras;
- categorias;
- transações;
- nova categoria inline dentro do lançamento de transação.

As listas continuam visíveis ao fundo para preservar contexto, e mensagens de erro dos formulários aparecem dentro do respectivo modal. Filtros e relatórios continuam inline porque não criam nem editam entidades.

Sem migration neste ajuste.
