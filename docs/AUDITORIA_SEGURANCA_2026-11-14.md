# Auditoria de segurança — Radar Vagas Hub
**Data:** 14/11/2026 • **Escopo:** dependências npm, código do PR #1, acesso Supabase/PostgreSQL de produção e GitHub Actions.

> **ATUALIZAÇÃO APÓS APROVAÇÃO:** A auditoria inicial foi somente leitura. Em 14/11/2026, após autorização expressa, foram aplicadas **apenas** as duas correções prioritárias de grants e EXECUTE descritas abaixo. Nenhum registro de vaga ou política RLS foi alterado. O código do PR recebeu proteções adicionais.

## Resumo executivo

| Área | Estado | Resultado |
|---|---|---|
| Runtime npm | **OK segundo npm audit** | 0 vulnerabilidades na execução após atualizar `zod` para 4.6.7 |
| Ferramentas de desenvolvimento | **Risco moderado identificado** | 7 alertas derivados da mesma dependência vulnerável `minimatch@10.2.6` (CVE-2026-118764) |
| Frontend → Supabase | **Arquitetura correta, limites a reforçar** | Usa `VITE_SUPABASE_PUBLISHABLE_KEY` pública, não a Secret Key; cliente faz SELECT paginado |
| RLS | **Ativo** | 4/4 tabelas do esquema public com RLS habilitada |
| Grants de anon/authenticated | **Corrigido em produção** | TRUNCATE/TRIGGER/REFERENCES revogados em `jobs` e `radar_status` |
| Função privilegiada pública | **Corrigido em produção** | `public.rls_auto_enable()` não possui mais EXECUTE para PUBLIC/anon/authenticated |
| Extensão `pg_trgm` | **Aviso** | Instalada em `public`; planejar migração de schema com teste de índices |
| Histórico acessível | **Decisão de produto / defesa em profundidade** | RLS filtra `active=true`, não a janela de 7 dias |
| RLS sem policy em duas tabelas | **Comportamento intencional de bloqueio** | `job_discoveries` e `radar_status` não possuem SELECT público |
| Performance | **14 avisos informativos** | Índices sem uso observado; não eliminar sem observar workload real |

Não foi identificada evidência de comprometimento, mas ausência de evidência não prova que não houve exploração. Segurança de contas, GitHub Secrets, Cloudflare em produção e histórico integral de commits exigem verificações próprias, fora do escopo das consultas feitas.

## 1. Dependências: análise dos sete alertas

O GitHub Actions executou `npm audit` em escopos distintos, a partir do lockfile versionado.

- **Runtime `npm audit --omit=dev`: 0 vulnerabilidades.**
- **Todas as dependências: 7 moderadas e 0 altas/críticas.**
- Os sete registros são o **mesmo problema transitivo** que se propaga pelo grafo:
  `minimatch` → `@typescript-eslint/typescript-estree` → `@typescript-eslint/parser`, `@typescript-eslint/type-utils`, `@typescript-eslint/utils`, `@typescript-eslint/eslint-plugin`, `typescript-eslint`.
- `package-lock.json` fixa `@typescript-eslint/typescript-estree@8.72.2` com `minimatch@10.2.6` (dev only). Existe outro `minimatch@3.1.5`, mas **não é a origem desses sete alertas**.
- Advisory: [GHSA-g3hv-75wg-m249 / CVE-2026-118764](https://github.com/advisories/GHSA-g3hv-75wg-m249). Versões afetadas `>=7 <11.0.1`; corrigido em `11.0.1+`.
- Vetor descrito no advisory: padrões glob controlados por terceiros podem amplificar processamento (negação de serviço). Nesta aplicação, a dependência aparece no **lint/build**, não na consulta pública de vagas.
- `typescript-eslint@8.72.2` depende de `minimatch: ^10.2.2`. A correção requer mudança de versão principal do transitive dependency, não é seguro aplicar `--force` sem teste de compatibilidade. **Manter este risco moderado documentado** até validar override direcionado `minimatch@11.0.1+` (lint + tipos + build + testes) ou atualização compatível do upstream.

**Medidas aplicadas no PR:** `zod@4.6.7` fixado, `package-lock.json` incluído, CI passou a usar `npm ci` e bloqueia `npm audit --omit=dev --audit-level=high`.

## 2. Supabase: controles confirmados

Projeto `mrnoslwscnvpwrjsfqgk`.

- `public.jobs`, `public.jobs_legacy_20260807`, `public.job_discoveries`, `public.radar_status`: **RLS habilitada**.
- `public.jobs` possui policy `public_read_active_jobs` para `anon,authenticated`: `SELECT USING (active = true)`.
- `jobs_legacy_20260807` tem policy semelhante permitindo SELECT somente nas linhas ativas; não é utilizada pela nova pesquisa do frontend.
- `job_discoveries` e `radar_status` não têm policy de leitura pública; o papel `anon` também não possui SELECT concedido nessas tabelas. O aviso **RLS Enabled No Policy** do advisor é informativo neste contexto.
- `anon` e `authenticated` não possuem INSERT, UPDATE ou DELETE nas quatro tabelas. `service_role` tem permissões elevadas e ignora RLS por projeto: **nunca expor suas credenciais ao navegador**.
- O frontend usa `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. A chave `sb_publishable_...` é desenhada para ser pública, mas só é segura em conjunto com grants e RLS.
- `.env.collector.local` está ignorado no Git; o PR não inclui seu conteúdo. Os scripts usam `SUPABASE_SECRET_KEY` apenas em Node para administração. **O conteúdo dos secrets no GitHub Actions não foi inspecionado**.
- Busca via Supabase limitada no app a 20 linhas por página; termos são filtrados/normalizados antes de gerar a expressão `PostgREST.or`, reduzindo injeção de sintaxe na pesquisa.
- Links das candidaturas são renderizados como âncoras com `rel="noopener noreferrer"`, e o merge valida protocolos HTTP(S).

**Importante:** a chave pública permite chamadas à API independentemente do frontend. Nunca considerar os filtros visuais uma barreira de segurança.

## 3. Grants excessivos — correção aplicada e verificada

Consultas `has_table_privilege` e `pg_class.relacl` confirmaram que `anon` e `authenticated` possuem:

- `jobs`: `SELECT` (necessário), mais `TRUNCATE`, `TRIGGER` e `REFERENCES` (desnecessários);
- `radar_status`: `TRUNCATE`, `TRIGGER`, `REFERENCES` (desnecessários), sem SELECT público;
- `jobs_legacy_20260807`: apenas SELECT público;
- `job_discoveries`: sem grants públicos nas operações principais.

**Risco:** RLS **não protege TRUNCATE**. Embora a API REST comum não exponha um endpoint TRUNCATE, conceder esse privilégio ao papel público viola o princípio do menor privilégio e aumenta o impacto potencial de funções SQL expostas ou outros vetores. Não há demonstração de exploração no projeto.

**SQL aplicado em produção, após autorização expressa (14/11/2026):**

```sql
BEGIN;

REVOKE TRUNCATE, TRIGGER, REFERENCES
  ON TABLE public.jobs, public.radar_status
  FROM anon, authenticated;

REVOKE EXECUTE
  ON FUNCTION public.rls_auto_enable()
  FROM PUBLIC, anon, authenticated;

COMMIT;
```

A função `rls_auto_enable()` está associada ao event trigger `ensure_rls` e não deveria ser chamada como RPC público. O EXECUTE público foi revogado; após a alteração, o gatilho permaneceu **ativo** (`evtenabled='O'`) e o papel `postgres` manteve EXECUTE.

**Verificação read-only executada após a migração:**

```sql
SELECT
  has_table_privilege('anon', 'public.jobs', 'SELECT') AS leitura_publica_preservada,
  has_table_privilege('anon', 'public.jobs', 'TRUNCATE') AS truncate_anon,
  has_table_privilege('authenticated', 'public.radar_status', 'TRUNCATE') AS truncate_autenticado,
  has_function_privilege('anon', 'public.rls_auto_enable()', 'EXECUTE') AS executa_funcao_privilegiada;
```

**Confirmado:** `true, false, false, false`. Os demais grants `TRUNCATE`, `TRIGGER`, `REFERENCES` de `anon` e `authenticated` foram verificados como `false` nas tabelas afetadas. `service_role` manteve INSERT/UPDATE, as policies RLS permaneceram intactas, e a consulta de leitura usando `SET LOCAL ROLE anon` retornou **128.904 vagas ativas, 20.818 recentes**. A contagem total permaneceu em **150.455**. O teste visual no navegador após essa migração ainda é recomendado.

**Referência oficial:** https://supabase.com/docs/guides/api/securing-your-api

## 4. Outros avisos do Supabase Advisor

- **`anon_security_definer_function_executable` + `authenticated_security_definer_function_executable` (WARN):** os dois avisos relativos a `public.rls_auto_enable()` **desapareceram** após a migração, conforme nova execução do Security Advisor.
- **`extension_in_public` (WARN):** `pg_trgm` está instalado em `public`. Para reduzir a superfície exposta, avaliar movê-lo para `extensions`, mas **não mover nesta etapa**: índices `GIN` e referências ao operador `public.gin_trgm_ops` devem ser testados e, se necessário, revisados.
- **`rls_enabled_no_policy` (INFO, duas tabelas):** `radar_status` e `job_discoveries`; essa configuração bloqueia leitura/escrita pública por falta de policy e de grants de leitura.
- **Health:** sem avisos.
- **Performance:** 14 recomendações informativas de índices não usados. Índices recentes ou pouco consultados ainda podem ser necessários; coletar métricas de carga antes de remover.

Referências Supabase:
- https://supabase.com/docs/guides/observability/advisors?queryGroups=lint&lint=0028_anon_security_definer_function_executable
- https://supabase.com/docs/guides/observability/advisors?queryGroups=lint&lint=0029_authenticated_security_definer_function_executable

## 5. Política de recência no banco

A policy atual `active=true` concede acesso público a qualquer vaga marcada ativa, independentemente da data. Na auditoria, **108.086 registros ativos anteriores a sete dias** continuavam selecionáveis pelo papel público conforme grants/policy. O site aplica a janela de 7 dias no frontend.

Não são dados privados por definição (vagas públicas), mas essa exposição contraria o comportamento de catálogo recente e aumenta a superfície de scraping e os custos de consulta. Após revisar compatibilidade com o site e eventuais consumidores da API, considerar ajustar a policy para:

```sql
-- PROPOSTA, NÃO EXECUTAR SEM REVISÃO E AUTORIZAÇÃO:
ALTER POLICY public_read_active_jobs ON public.jobs
USING (
  active = true
  AND published_at >= now() - interval '7 days'
  AND published_at <= now()
);
```

Também avaliar retirar SELECT público de `jobs_legacy_20260807` **somente após confirmar que não existe consumidor**.

## 6. Segurança dos scripts administrativos

Alterações realizadas no PR **sem executar gravação em produção**:

- `scripts/test-supabase-write.mjs`: antigo teste que escrevia uma vaga agora exige `--apply` explícito.
- `scripts/import-gupy-to-supabase.mjs`: importador antigo que gravava diretamente agora exige `--apply`; o caminho recomendado é o pipeline oficial.
- `scripts/sync-supabase.mjs`: o `--apply` normal permanece **somente upsert**. `--deactivate-absent` ou `--purge-expired` agora exigem também a variável `RADAR_ALLOW_DESTRUCTIVE_SYNC=YES_I_HAVE_A_VERIFIED_BACKUP`, além da aprovação operacional.

O workflow de produção mantém `RADAR_ENABLE_PRODUCTION_SYNC` desativado por padrão. **Não ativar automação nem merge com SQL pendente sem decisão explícita sobre a postura de segurança desejada**.

### Redução de exposição de segredos no CI

Na auditoria do workflow de atualização havia outro risco: `SUPABASE_SECRET_KEY` era configurada no ambiente **do job inteiro**. Isso expunha a credencial administrativa também aos processos de `npm ci`, de cache e de coleta, embora eles não precisem dela.

A branch do PR foi corrigida para disponibilizar `SUPABASE_SECRET_KEY` e `SUPABASE_URL` **somente nas etapas de validação das credenciais e sincronização autorizada**, com `RADAR_ENABLE_PRODUCTION_SYNC == 'true'`. As demais etapas não recebem a chave. Nenhuma rotação de chaves ou alteração de Secrets foi executada.

## 7. Itens fora do escopo e validação final

Não foi possível verificar por estes acessos: valores dos GitHub Actions Secrets, Cloudflare em execução, configurações de MFA das contas, histórico integral de credenciais já removidas, ou simular um ataque real à API pública. A auditoria cobre políticas, grants, código atual e evidências de CI, não substitui pentest independente.

Antes de considerar a publicação liberada:

1. **Concluído:** revogações mínimas de GRANT e EXECUTE, consulta pós-migração e teste da leitura pública simulada com o papel `anon`. Recomenda-se teste adicional no navegador.
2. Decidir sobre a política de 7 dias no RLS e exposição da tabela legacy.
3. Documentar aceitação temporária ou testar override de minimatch 11 (dev-only); não usar `--force` automaticamente.
4. Testar o deploy Cloudflare e confirmar headers, chave pública no bundle e indisponibilidade de RPC privilegiadas.
5. Manter o backup SQL seguro fora do Git e configurar monitoramento da cota Supabase.

**Próxima fase após a segurança: revisão de UX/UI de `/` e `/vagas`, priorizando campo de busca, modalidade, filtros essenciais e cards mais objetivos.**
