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

**Atenção:** `sync-supabase.mjs --apply` ainda executa atualização em lote,
desativação de registros ausentes e exclusão física por janela de 15 dias.
Não executar para validar apenas o endpoint.

## Validação InHire (14/11/2026)

Na primeira coleta local, foram consultadas 8.725 vagas do índice, mas a fonte
utilizava a janela compartilhada de apenas 7 dias. Foram obtidas 685 vagas
válidas nessa janela e 24 tenants apresentaram HTTP 404. O cache de datas
`published_at` foi aquecido com 8.725 entradas.

A constante `WINDOW_DAYS` em `scripts/collector-standard.mjs` foi alinhada
para 15 dias (impacta InHire e InfoJobs). É necessário refazer a coleta InHire
após atualizar a branch local, aproveitar o cache disponível e validar o novo
volume antes de qualquer sincronização. Os 24 tenants que falharam precisam
ser revisados separadamente, sem inventar datas. A listagem do InfoJobs utiliza
um filtro de antiguidade próprio da plataforma e exige auditoria de cobertura.
