# Release 1 - Fase 1: Contas Financeiras

## Escopo

A Fase 1 permite cadastrar e gerenciar contas financeiras por perfil, moeda e finalidade, preservando o isolamento patrimonial entre perfis.

## Correções aplicadas nesta revisão

- A página de perfis financeiros deixou de ser apenas listagem e passou a permitir adicionar novos perfis.
- A página de perfis financeiros passou a permitir editar nome, tipo e moeda base de um perfil existente.
- Perfis ativos agora aparecem no cadastro de contas.
- O cadastro de contas exibe alerta quando não há perfil ativo disponível.
- O backend passou a expor atualização e arquivamento de perfis financeiros.
- A restrição única por tipo de perfil foi removida para permitir múltiplos perfis do mesmo tipo quando necessário.
- Arquivamento de perfil é bloqueado quando ainda existem contas não fechadas vinculadas.

## Migration

Esta revisão inclui migration nova:

```text
20260624224500_fase_1_profiles_crud_fix
```

A migration remove a constraint única `FinancialProfile_userId_type_key` e cria índice normal por `userId` e `type`.

## Comandos para aplicar

```powershell
pnpm install
pnpm prisma:generate
pnpm prisma:migrate:dev --name fase_1_profiles_crud_fix
pnpm --filter api start:dev
pnpm --filter web dev
```

## Validação

```powershell
pnpm prisma:validate
pnpm --filter api typecheck
pnpm --filter web typecheck
pnpm --filter api test
pnpm build
```

## Commit da correção da Fase 1

```powershell
git add .
git commit -m "fix(finance): habilitar gerenciamento de perfis financeiros"
```

## Correção de UX e sincronização de perfis no cadastro de contas

- A página de perfis deixou de exibir formulário de criação/edição junto com a lista.
- A lista agora possui um botão primário "Adicionar perfil".
- A criação e a edição usam uma tela de formulário dedicada dentro do fluxo da página.
- O cadastro de contas agora busca perfis ativos da API, atualiza a lista ao focar a janela e possui botão "Atualizar perfis".
- Quando não houver perfil ativo, o cadastro de contas exibe link direto para "Gerenciar perfis".

Não houve alteração de schema Prisma, seed ou migration nesta correção.

## Correção - carregamento de contas e perfis

- O carregamento da página de contas foi separado em duas etapas: primeiro perfis financeiros, depois contas.
- Falha em `/accounts` não impede mais o select de perfis de ser preenchido.
- Erros 401 agora são tratados como sessão expirada.
- Erros 500/404/validação exibem a mensagem real da API em vez de orientar login indevidamente.
- O dashboard e a tela de perfis passaram a usar mensagens de erro mais específicas.


## Correção adicional - rotas de contas e base da API

### Problema corrigido

A página de contas podia exibir `Não foi possível carregar contas. Cannot GET /accounts` quando o frontend tentava consultar uma base de API diferente da exposta pelo backend ou quando a API estava configurada com prefixo `/api`.

### Ajustes

- O cliente HTTP do frontend normaliza `NEXT_PUBLIC_API_URL` removendo barra final.
- O cliente HTTP faz fallback automático de `/accounts` para `/api/accounts` quando a API responde 404 com `Cannot GET /accounts`.
- Controllers principais do backend passam a aceitar rotas sem prefixo e com prefixo `/api`:
  - `/accounts` e `/api/accounts`
  - `/financial-profiles` e `/api/financial-profiles`
  - `/auth` e `/api/auth`
  - `/users` e `/api/users`

### Observação operacional

Após aplicar esta correção, pare os processos antigos da API e do Web e suba novamente para evitar que o Nest continue servindo uma versão antiga compilada em `dist`.

## Correção de rotas da API de contas

- NestJS agora usa prefixo global `/api`.
- Controllers foram padronizados para rotas sem alias duplicado.
- Frontend usa `NEXT_PUBLIC_API_URL=http://localhost:3001/api` por padrão.
- Removido fallback automático que podia mascarar erro de configuração.
- Corrigido cenário em que o navegador chamava `/api/accounts` no servidor Next.js em vez do backend NestJS.

## Correção adicional — base URL da API no frontend

Foi corrigida a normalização de `NEXT_PUBLIC_API_URL` para impedir que o frontend chame acidentalmente o servidor do Next.js (`localhost:3000`) quando deveria chamar a API NestJS (`localhost:3001/api`).

Cenário corrigido:

- `NEXT_PUBLIC_API_URL=/api`
- `NEXT_PUBLIC_API_URL=http://localhost:3000/api`
- `NEXT_PUBLIC_API_URL=http://127.0.0.1:3000/api`
- valor ausente ou inválido

Todos esses casos agora são normalizados para `http://localhost:3001/api` no ambiente local.

## Correção operacional - start da API

O script da API foi ajustado para evitar o erro `Cannot find module apps/api/dist/main` quando o diretório `dist` não existir.

- Para desenvolvimento, use `pnpm --filter api start:dev`, que executa `nest start --watch` e compila em modo watch.
- Para desenvolvimento sem watch, `pnpm --filter api start` agora usa `nest start` e não depende de `dist`.
- Para produção, use `pnpm --filter api start:prod`, que executa `build` antes de `node dist/main.js`.

Comandos recomendados em ambiente limpo:

```powershell
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Remove-Item -Recurse -Force .\apps\api\dist -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .\apps\web\.next -ErrorAction SilentlyContinue

pnpm install
pnpm prisma:generate
pnpm --filter api start:dev
pnpm --filter web dev
```


## Correção adicional de inicialização da API

O script `pnpm --filter api start` foi alterado para `nest start`, evitando que o desenvolvimento tente executar `apps/api/dist/main` quando o build ainda não existe. Use `pnpm --filter api start:dev` durante desenvolvimento e `pnpm --filter api start:prod` somente para produção.


## Correção de runtime da API - dist/main

### Problema
A API falhava com `Cannot find module apps/api/dist/main` porque o `tsconfig.json` da API incluía arquivos externos de `packages/shared/src`. Isso alterava a raiz comum de compilação e impedia a geração esperada de `apps/api/dist/main.js`.

### Correção
- `apps/api/tsconfig.json` voltou a compilar apenas `apps/api/src`.
- `@financas/shared` passa a ser compilado antes de `build`, `start`, `start:dev` e `start:prod` da API.
- Adicionado `apps/api/tsconfig.spec.json` para manter testes incluindo `test/**/*.ts` sem afetar o build da aplicação.
- Sem migration.


## Correção runtime auth/audit

- Removida dependência direta e não utilizada de `AuditService` dentro do `AuthModule` e `AuthService`.
- O registro de auditoria do cadastro continua sendo feito transacionalmente via Prisma.
- Corrige `Cannot find module ../audit/audit.service` no runtime compilado da API.
- Sem migration.

## Correção estrutural de runtime da API

### Problema corrigido

A API estava acumulando erros de runtime por mistura entre código fonte, build antigo em `dist`, dependência runtime desnecessária do pacote `@financas/shared` e imports antigos de auditoria.

### Ajustes aplicados

- A API não depende mais de `@financas/shared` para registrar perfis padrão no cadastro.
- Os perfis padrão foram movidos para constante local tipada em `AuthService`.
- Criado `AuditModule` para organizar `AuditService` e evitar provider solto.
- `AppModule` importa `AuditModule` de forma explícita.
- Scripts da API agora limpam `dist` antes de desenvolvimento e build.
- `start:dev` usa `nest start --watch`, sem depender de `dist/main.js` pré-existente.
- `start:prod` faz build antes de executar `node dist/main.js`.

### Resultado esperado

Após extrair o ZIP em pasta limpa e rodar os comandos documentados, a API deve subir em `http://localhost:3001/api`, com as rotas:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/financial-profiles`
- `GET /api/accounts`
- `GET /api/accounts/summary`

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
