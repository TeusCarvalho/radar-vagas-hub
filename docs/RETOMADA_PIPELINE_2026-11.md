# Retomada do pipeline — novembro/2026

## Contexto

A execução de 19/10/2026 falhou na etapa `Coletar Gupy` com HTTP 404:
a URL antiga `employability-portal.gupy.io/api/v1/jobs` deixou de atender.
Último registro de sincronização bem-sucedida observado no Supabase:
20/08/2026. Registros previamente marcados `active=true` podem estar obsoletos.

## Alterações deste PR

- Atualização para o endpoint público `https://portal.gupy.io/api/job-search/jobs`
  com contrato explícito `{ data: [...] }`.
- Testes unitários e smoke test de leitura (sem conexão ao Supabase).
- Execução de todos os coletores para diagnóstico, mesmo quando um falhar.
- Bloqueio de merge/sync caso qualquer uma das seis fontes falhe ou produza
  catálogo vazio. **Este PR não faz sincronização parcial.**
- Alinhamento do validador do Supabase para incluir InfoJobs.

## Validação antes de habilitar produção

1. Conferir os checks de testes e smoke test no PR.
2. Executar o workflow manualmente em ambiente controlado e revisar volume,
   datas, distribuição por fonte e exemplos de links válidos.
3. Verificar o risco de substituição do catálogo existente, já bastante
   desatualizado, antes de liberar `sync-supabase.mjs --apply`.
4. Confirmar a configuração do agendamento do GitHub Actions após o merge.

**Atenção (revisado em 14/11/2026):** `sync-supabase.mjs --apply`
agora executa upserts, sem desativação em massa ou exclusão física por padrão.
As opções `--deactivate-absent` e `--purge-expired` são separadas e
permanecem proibidas até termos backup testado. A execução agendada está
bloqueada por `RADAR_ENABLE_PRODUCTION_SYNC` e o PR segue em rascunho.
Não executar `--apply` para validar somente o endpoint.

## Critério de recência preservado

A janela de 7 dias em `scripts/collector-standard.mjs` é uma decisão
intencional do projeto para InHire e InfoJobs: reduzir o risco de listar
anúncios antigos que continuam publicados por muito tempo. Por solicitação
do proprietário, esse valor **não deve ser ampliado automaticamente**.

Na validação da InHire em 14/11/2026 foram encontradas 685 vagas válidas
com publicação dentro de 7 dias, 8.725 registros no índice e 24 tenants com
HTTP 404. A coleta concluiu sem itens inválidos. Os 404 são uma pendência de
cobertura, não motivo para alterar a janela de publicação.

Atualização: o projeto foi posteriormente padronizado para 7 dias nas
seis fontes e no merge final. A idade da publicação, isoladamente, não
comprova que a candidatura continua aberta.

## Política unificada: 7 dias; InfoJobs com empresa não identificada

Todos os seis coletores usam 7 dias. Além disso, o merge valida novamente
a janela de publicação antes de deduplicar. Datas futuras, ausentes ou
inválidas são rejeitadas; no Greenhouse, `updated_at_fallback` não é aceito
como publicação e, no Lever, `first_seen_fallback` também não é aceito.

As vagas do InfoJobs sem nome de empresa são **mantidas** e, apenas na saída
pública, exibidas como `Empresa confidencial`, conforme preferência do produto.
Esse rótulo significa que o nome **não foi identificado na fonte**: não é
uma afirmação de sigilo confirmado pelo empregador. Registros com empresa
não identificada continuam **fora da deduplicação entre plataformas baseada
na identidade da empresa**, para evitar falsos positivos.

O relatório de merge passa a incluir `publication_window_days`,
`eligible_inputs`, `excluded_by_reason`, `excluded_by_source` e
`infojobs_company_confidential`. O synchronizador também valida a idade
do catálogo antes de qualquer gravação. A retenção física do banco permanece
separada em 15 dias e **não deve ser confundida** com a janela visível de 7.

No frontend, a fonte InfoJobs é reconhecida e rotulada corretamente e as
consultas ao Supabase limitam a busca aos últimos 7 dias. Assim, o site
não expõe registros antigos ainda marcados como ativos em um banco desatualizado.

**Não executar** `sync-supabase.mjs --apply` antes de validar o backup
e a migração InfoJobs. Consultar `docs/PREPARACAO_SUPABASE_PRODUCAO.md`.
