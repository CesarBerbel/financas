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
