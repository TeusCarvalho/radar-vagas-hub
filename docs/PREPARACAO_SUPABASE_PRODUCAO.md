# Supabase — preparação, recuperação e primeira sincronização do Radar Vagas

> **Estado em 14/11/2026:** backup e restauração de teste concluídos; migração para InfoJobs aplicada; primeira sincronização concluída; próxima etapa é validar segurança e deploy do frontend. As operações relatadas ocorreram com autorização expressa do responsável pelo projeto. **Não repetir importação nem exclusão por conta própria.**

## 1. Registro da execução

Projeto: `mrnoslwscnvpwrjsfqgk`. Tabela: `public.jobs`.

| Marco | Evidência |
|---|---|
| Banco antes da atualização | 129.645 registros; 108.094 ativos; 0 ativos publicados nos últimos 7 dias |
| Plano de backup | Supabase Free, sem backup automático disponível ao usuário |
| Backup lógico | `schema.sql` (15.168 bytes), `data.sql` (124.151.317 bytes), exportados com Supabase CLI v3.1.0 |
| Local informado pelo operador | `C:\Users\Pessoal\RadarVagas_Backup_20261114_164608` — **fora do repositório** |
| Restauração independente | PostgreSQL 17 via Docker, `radar-backup-teste`, banco `radar_restore` |
| Teste de integridade principal | `COPY 129645` + `SELECT COUNT(*) FROM public.jobs = 129645` |
| Fontes autorizadas no banco | Gupy, InHire, Greenhouse, Lever, Ashby e InfoJobs |
| Primeira sincronização | 14/11/2026, 20:31:27–20:32:00 UTC, 53/53 lotes, 20.818 upserts |
| Banco após a carga | 150.455 registros totais; 128.904 ativos; 20.818 recentes e ativos |
| Duplicidades `(source,external_id)` | 0 |
| RLS `public.jobs` | Habilitada |
| Último status de carga | `radar_status.id='main'`, `status='success'` |

**Backup: escopo limitado ao esquema `public` do PostgreSQL.** Não equivale a snapshot integral de autenticação, arquivos do Storage, configurações e demais serviços gerenciados. Guardar outra cópia segura. A conferência de quantidade e uma restauração independente comprovam recuperação das tabelas testadas, mas não dispensam testes de aplicação pós-restauração.

## 2. Como o backup manual foi executado

O Supabase recomenda exportação lógica no plano gratuito. O Supabase CLI v3 usa o alvo local por padrão; `--remote` aponta explicitamente para o projeto de produção.

```powershell
npx.cmd supabase --version
npx.cmd supabase db dump --help
npx.cmd supabase login

$backup = Join-Path $env:USERPROFILE ("RadarVagas_Backup_" + (Get-Date -Format "yyyyMMdd_HHmmss"))
New-Item -ItemType Directory -Force -Path $backup

npx.cmd supabase db dump --remote=mrnoslwscnvpwrjsfqgk --schema public --file "$backup\schema.sql"
npx.cmd supabase db dump --remote=mrnoslwscnvpwrjsfqgk --schema public --data-only --use-copy --file "$backup\data.sql"
```

A pasta de backup não deve ser versionada, publicada ou compartilhada com tokens.

Referências oficiais:
- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/reference/cli/supabase-db-dump

## 3. Restauração de teste (executada)

Contêiner PostgreSQL 17 criado localmente com `--network none` e sem mapeamento de portas. A restauração inicial revelou dependências do Supabase que precisaram ser instaladas no banco de teste: extensão `pg_trgm` no esquema `public` e papéis `authenticated`, `anon` e `service_role` sem login.

Depois de preparar as dependências, o esquema e os dados foram restaurados com `psql -X -v ON_ERROR_STOP=1`. Contagens restauradas:

- `job_discoveries`: 27.288
- `jobs`: 129.645
- `jobs_legacy_20260807`: 298
- `radar_status`: 1

A contagem de `public.jobs` correspondeu ao original. O ambiente de restauração é isolado e **não modifica o Supabase remoto**.

## 4. Migração aplicada em produção: incluir InfoJobs

Após autorização e backup validado, a restrição `rv_jobs_source_ck` foi atualizada:

```sql
ALTER TABLE public.jobs
  DROP CONSTRAINT rv_jobs_source_ck,
  ADD CONSTRAINT rv_jobs_source_ck
  CHECK (source IN (
    'gupy', 'inhire', 'greenhouse', 'lever', 'ashby', 'infojobs'
  ));
```

A consulta posterior a `pg_constraint` confirmou a inclusão de `infojobs` e a validade da constraint; os 129.645 registros anteriores permaneceram intactos após o ajuste. A reversão para cinco fontes exigiria tratar previamente os registros InfoJobs.

## 5. Primeira sincronização real (executada)

O catálogo local passou pela validação pré-carga: 21.880 registros brutos, 20.818 elegíveis (7 dias), 1.062 excluídos, 0 inválidos e 0 duplicidades detectadas. Em seguida, o operador executou **somente**:

```powershell
node scripts/sync-supabase.mjs --apply
```

O sincronizador fez 20.818 upserts, em 53 lotes. O script preservou as proteções:
- nenhuma desativação em massa (`--deactivate-absent` **não** fornecido);
- nenhuma exclusão física (`--purge-expired` **não** fornecido);
- histórico existente mantido, com atualizações nas chaves coincidentes;
- status final registrado como sucesso.

Consulta de validação por origem (últimos sete dias e `active=true`):

| Fonte | Registros |
|---|---:|
| gupy | 10.014 |
| infojobs | 9.865 |
| inhire | 685 |
| greenhouse | 179 |
| ashby | 49 |
| lever | 26 |
| **Total** | **20.818** |

Total do banco após a importação: **150.455** registros (incluindo históricos); **128.904** ativos. Sem duplicidade de `source,external_id`. O estado de uma vaga individual ainda depende de confirmação na fonte original.

## 6. Operação contínua e controles pendentes

- **PR #1 continua em draft** e o novo frontend ainda exige merge, deploy e verificação no domínio público.
- GitHub Actions agenda 08h e 18h de Brasília, mas a variável `RADAR_ENABLE_PRODUCTION_SYNC` deve ficar ausente/falsa até aprovação específica. Sem essa variável, o job agendado não executa.
- Configurar `SUPABASE_URL` e `SUPABASE_SECRET_KEY` exclusivamente nos secrets do repositório para execução de produção; nunca usar `VITE_` para credenciais secretas.
- A sincronização só faz upsert por padrão. Decidir futuramente desativação de registros ausentes e exclusão física (15 dias) **separadamente**, após novo backup e avaliação de impacto.
- Não existe transação global para 53 lotes; em falhas, verificar quais lotes foram aplicados antes de qualquer repetição.
- Revisar avisos de dependências npm e testar o site de produção após o deploy.
- No plano Free, acompanhar espaço do banco, tráfego e limites de cota, sem presumir capacidade ilimitada.

## 7. Recuperação em incidentes

1. Desativar `RADAR_ENABLE_PRODUCTION_SYNC` e interromper novas gravações automáticas.
2. Registrar contagens e identificar lotes/alterações afetados.
3. Não realizar `DELETE`, `DROP TABLE` ou reexecução automática para tentar corrigir.
4. Utilizar o backup testado em ambiente controlado, avaliando quais dados surgiram desde a exportação.
5. Planejar qualquer restauração em produção com verificação de políticas, chaves e usuários.

**Não incorporar os arquivos de backup SQL ao repositório Git.**
