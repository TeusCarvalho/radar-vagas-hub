# Implantação do Radar Vagas no Cloudflare Workers

## Ambiente e integração

- **Worker existente:** `teuscarvalho-radar-vagas-hub`
- **Repositório:** `TeusCarvalho/radar-vagas-hub`
- **Branch de produção:** `main`
- **Branch de validação:** `fix/recuperar-coleta-gupy-20261114`
- **Build:** `npm run build`
- **Implantação de produção:** `npx wrangler deploy`
- **Implantação de prévia:** `npx wrangler preview`

O Worker já está conectado ao GitHub no painel do Cloudflare. A configuração
`wrangler.jsonc` declara o **mesmo nome** do Worker existente,
`main: .output/server/index.mjs` e `assets.directory: .output/public`.

## Etapa 1: prévia sem alterar produção

O projeto mantém **Preview Builds** habilitados. Uma alteração enviada para a
branch de validação, que **não** é a branch `main`, deve iniciar uma build de
prévia no Cloudflare. Essa build utiliza o comando `npx wrangler preview` e
**não deve substituir a implantação ativa**.

1. Abrir **Workers & Pages → teuscarvalho-radar-vagas-hub → Implantações**.
2. Conferir **histórico de compilação** e a seção de **prévia** (não confundir
   com a lista de implantações ativas em produção).
3. Se a prévia falhar, ler os **logs de compilação**, sem clicar em implantar
   em produção nem fazer merge.
4. Se houver URL de prévia, testar `/`, `/vagas`, paginação, filtros,
   pesquisa “Analista de Dados”, “Remotas” e acesso à candidatura original.
5. Confirmar que a chave `VITE_SUPABASE_PUBLISHABLE_KEY` pública foi incluída
   no build, mas **nunca incluir** `SUPABASE_SECRET_KEY` ou outro segredo
   administrativo no bundle.
6. Conferir a renderização responsiva, o modo escuro e o tratamento de erros.

A lista **Implantação ativa** pode continuar mostrando apenas versões
manuais antigas mesmo quando a build de prévia foi criada; a prévia possui
visão e URL próprias.

## Etapa 2: produção (somente após validar prévia)

1. Conferir `npm run build`, testes, TypeScript, auditoria de runtime e
   `wrangler deploy --dry-run` no CI.
2. Aprovar o PR #1 e integrar a branch à `main`.
3. Monitorar a **primeira build de produção** no painel do Cloudflare.
4. Validar `https://teuscarvalho-radar-vagas-hub.teuscarvalho.workers.dev/`
   e `/vagas` sem depender do servidor de desenvolvimento.
5. Monitorar logs e usar o histórico de versões do Worker para rollback, se
   necessário.

**Não habilitar `RADAR_ENABLE_PRODUCTION_SYNC` automaticamente**: a rotina
de atualização das seis fontes é uma operação separada, que requer validação
de execução agendada e credenciais administrativas específicas no GitHub.

Referências oficiais:
- https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/
- https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
- https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/
