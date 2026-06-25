# Release 1 - Fase 0 Fundação Técnica

## Branch da release

```powershell
git checkout main
git pull origin main
git checkout -b release/01-mvp-operacional
```

## Escopo entregue

- Monorepo pnpm com `apps/api`, `apps/web` e `packages/shared`.
- API NestJS com Prisma/PostgreSQL.
- Web Next.js com login, cadastro, dashboard e listagem de perfis.
- Usuário com e-mail/senha, sessão JWT e MFA preparado via campo `mfaEnabled`.
- Moedas BRL e EUR.
- Perfis financeiros obrigatórios criados no cadastro:
  - Pessoal Brasil.
  - Pessoal Portugal.
  - Empresa Portugal.
- Auditoria básica para registro de usuário, criação e troca de perfil.

## Commit da fase

```powershell
git add .
git commit -m "feat(finance): concluir fase 0 fundacao tecnica"
```

## PR ao final da Release 1

Executar apenas quando as fases 0, 1, 2 e 3 estiverem concluídas.

```powershell
git push -u origin release/01-mvp-operacional
gh pr create --base main --head release/01-mvp-operacional --title "Release 1 - MVP Operacional" --body "Entrega das fases 0, 1, 2 e 3 do sistema financeiro."
```

## Correção aplicada — resolução do pacote shared

Foi ajustada a resolução do pacote interno `@financas/shared` para o NestJS em modo watch:

- `apps/api/tsconfig.json` agora possui `paths` apontando para `packages/shared/src/index.ts`.
- `packages/shared` agora compila como CommonJS para compatibilidade direta com a API NestJS.
- `packages/shared/package.json` inclui `exports` e remove `type: module`.

Após atualizar, rode:

```powershell
pnpm install
pnpm --filter @financas/shared build
pnpm --filter api start:dev
```

## Correção de regressão — Login redireciona para dashboard

Correção aplicada no formulário de autenticação para que, após resposta positiva da API e armazenamento do `accessToken` em `localStorage`, o usuário seja redirecionado automaticamente para `/dashboard` usando `router.replace('/dashboard')`.

Validação manual recomendada:

1. Abrir `http://localhost:3000/login`.
2. Informar e-mail e senha válidos.
3. Clicar em `Entrar`.
4. Confirmar que o token foi salvo no navegador.
5. Confirmar redirecionamento automático para `http://localhost:3000/dashboard`.
6. Confirmar carregamento dos perfis financeiros no dashboard.
