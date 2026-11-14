# Preparação segura do Supabase — Radar Vagas

**Status: PLANEJADO, NÃO EXECUTADO. Não aplicar mudanças no banco sem autorização.**

## 1. Auditoria somente leitura em 14/11/2026

- Projeto: mrnoslwscnvpwrjsfqgk; tabela: public.jobs.
- Banco existente: 129.645 registros; ativos: 108.094; ativos de 7 dias: 0.
- Publicação mais recente no banco: 30/09/2026; último status bem-sucedido: 20/08/2026.
- Catálogo local: 20.818 vagas elegíveis de 6 fontes.
- A constraint rv_jobs_source_ck atualmente admite somente gupy, inhire, greenhouse, lever e ashby. Falta infojobs.
- Existe unicidade (source, external_id) e índices para publicação e filtros.

## 2. Backup antes de qualquer mudança de esquema ou importação

Se o projeto dispuser de backups pelo plano, abrir Database > Backups no
dashboard e confirmar disponibilidade/recuperação. Não presumir que está disponível.
Para planos sem backup automático, criar dump lógico via Supabase CLI v3.
A CLI requer Docker e autenticação. Consultar --help antes de executar.

PowerShell (escolher uma pasta segura FORA do repositório):

    npx.cmd supabase --version
    npx.cmd supabase db dump --help
    npx.cmd supabase login
    npx.cmd supabase db dump --remote=mrnoslwscnvpwrjsfqgk --schema public --file "C:\PASTA_SEGURA\radar-schema.sql"
    npx.cmd supabase db dump --remote=mrnoslwscnvpwrjsfqgk --schema public --data-only --use-copy --file "C:\PASTA_SEGURA\radar-data.sql"

ATENÇÃO: Supabase CLI v3 usa o banco LOCAL como padrão; --remote explícito é
obrigatório. O dump padrão é SOMENTE do esquema. --data-only faz a cópia dos
dados. A CLI exclui os schemas gerenciados, como auth e storage. Manter
os arquivos fora do GitHub e de pastas públicas. Registrar hashes SHA-256.

O backup só será considerado validado após verificar que os arquivos
são legíveis e, preferencialmente, restaurá-los em ambiente de teste.

Docs: https://supabase.com/docs/guides/platform/backups
CLI: https://supabase.com/docs/reference/cli/supabase-db-dump

## 3. Migração de constraint (SQL somente para revisão; NÃO EXECUTAR AINDA)

    ALTER TABLE public.jobs
      DROP CONSTRAINT rv_jobs_source_ck,
      ADD CONSTRAINT rv_jobs_source_ck
      CHECK (source IN ('gupy','inhire','greenhouse','lever','ashby','infojobs'));

É necessário validar backup antes de aplicar, observar lock de DDL e
confirmar constraint em pg_constraint após a mudança. A reversão para cinco
fontes depende de não existirem linhas de InfoJobs (ou de tratá-las antes).

## 4. Publicação inicial em fases

1. Confirmar backup/restore, constraint InfoJobs e secrets apenas de servidor.
2. Conferir catálogo com node scripts/sync-supabase.mjs (dry run LOCAL).
3. Executar primeira carga somente com --apply após aprovação explícita.
   O script está preparado para upsert apenas, sem desativação em massa e
   sem exclusão física por padrão. InfoJobs é o primeiro lote.
4. Validar total real por origem, RLS de leitura e páginas do frontend.
5. A rotina de desativação de ausentes (--deactivate-absent) e a exclusão
   física (--purge-expired) exigem decisão posterior e backup revalidado.
6. Habilitar a variável GitHub RADAR_ENABLE_PRODUCTION_SYNC=true somente
   depois da aprovação. O workflow agendado fica sem sincronização até lá.

CUIDADO: os lotes de upsert não têm transação única; uma falha pode deixar
uma carga parcial. Não assumir que a operação é reversível sem backup.

## 5. Critérios para liberar o site

- 6 fontes presentes na tabela; InfoJobs exibido corretamente.
- Vagas publicadas há até 7 dias.
- Pesquisa, filtros e paginação funcionando na versão publicada.
- Urls de candidatura e localizações validadas por amostragem.
- VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY configuradas no ambiente
  de publicação do frontend, nunca a chave secreta.
- Nenhum dado antigo apagado no rollout inicial.

## 6. Rollback

- Desabilitar a variável RADAR_ENABLE_PRODUCTION_SYNC se houver incidente.
- Verificar contagem e danos de upsert antes de qualquer compensação.
- Restaurar somente a partir de backup testado, em ambiente controlado.
- Nunca resolver incidentes com DELETE amplo ou DROP TABLE sem plano aprovado.

Nenhuma escrita no Supabase foi realizada nesta etapa.
