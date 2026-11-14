# Radar Vagas Hub

**Hub público e independente de vagas de emprego** de múltiplas plataformas de recrutamento, com busca, filtros e direcionamento para a candidatura original.

- **Site atualmente publicado:** https://teuscarvalho-radar-vagas-hub.teuscarvalho.workers.dev
- **Stack:** React, TypeScript, TanStack Router/Query, Vite, Node.js, Supabase/PostgreSQL e Cloudflare Workers
- **Status do código de recuperação:** [PR #1 em rascunho](https://github.com/TeusCarvalho/radar-vagas-hub/pull/1). A versão pública ainda precisa receber e validar o novo frontend.

> O Radar Vagas é um agregador, não uma plataforma de candidatura nem uma fonte oficial das empresas. Confirme sempre a disponibilidade da vaga e suas condições no anúncio original.

## Fontes integradas

O pipeline consulta **seis fontes**:

| Fonte | Coletor |
|---|---|
| Gupy | `scripts/collect-gupy.mjs` |
| InHire | `scripts/collect-inhire.mjs` |
| Greenhouse | `scripts/collect-greenhouse.mjs` |
| Lever | `scripts/collect-lever.mjs` |
| Ashby | `scripts/collect-ashby.mjs` |
| InfoJobs | `scripts/collect-infojobs.mjs` |

Cada fonte transforma os dados de origem para um formato comum. Datas de publicação ausentes, futuras ou de procedência não confiável não são inventadas e podem causar a exclusão da vaga do catálogo.

O InfoJobs pode não identificar a empresa de algumas vagas. Nesses casos o catálogo exibe **“Empresa confidencial”** como rótulo neutro para empresa não identificada — isso não comprova sigilo confirmado pelo anunciante.

## Política de publicação

O catálogo trabalha com uma **janela móvel de sete dias**, aplicada nas seis fontes, no merge e na consulta pública. O prazo de publicação não comprova que a candidatura permanece aberta.

- Apenas vagas com data de publicação válida e verificável entram no catálogo.
- Nenhuma data ausente é substituída pela data da coleta.
- Os dados são deduplicados por `(source, external_id)` dentro de cada fonte.
- Entre plataformas, a deduplicação é **conservadora**, considerando empresa, título e localização. Vagas com empresa não identificada não são deduplicadas entre plataformas apenas por similaridade.
- A categoria profissional pode ser ajustada por regras explícitas do título, para reduzir classificações equivocadas (por exemplo, cargos de Vendas não devem ser classificados como Produto pela descrição).

## Última carga validada em produção

**14/11/2026**, com backup lógico do esquema `public` testado em PostgreSQL 17 isolado antes da importação.

| Fonte | Vagas recentes e ativas |
|---|---:|
| Gupy | 10.014 |
| InfoJobs | 9.865 |
| InHire | 685 |
| Greenhouse | 179 |
| Ashby | 49 |
| Lever | 26 |
| **Total** | **20.818** |

Os seis coletores retornaram **21.880 registros brutos**, dos quais **20.818** cumpriram a política de sete dias; **1.062** foram excluídos por política. Foram corrigidas **207 categorias pelo título** e **5.101** vagas InfoJobs receberam o rótulo neutro de empresa não identificada.

A primeira sincronização executou **53/53 lotes**, com **20.818 upserts**, sem exclusão física e sem desativação em massa. A consulta posterior confirmou **20.818 vagas recentes e ativas** na tabela `public.jobs`, **150.455 registros totais** (incluindo históricos), e status de sincronização `success`. Esses números são um retrato da execução, não uma contagem fixa.

## Arquitetura

```text
Gupy · InHire · Greenhouse · Lever · Ashby · InfoJobs
                      ↓
      Coletores e normalização por fonte
                      ↓
        Política de publicação: 7 dias
                      ↓
       Merge, qualidade e deduplicação
                      ↓
          Supabase / PostgreSQL
                      ↓
    jobsRepository (filtros e paginação SQL)
                      ↓
            Frontend React
                      ↓
           Cloudflare Workers
```

O frontend consulta o Supabase com **20 vagas por página**, filtro de modalidade, senioridade, UF, categoria, contrato e origem, além de pesquisa por cargo/empresa. A ordem implementada é por **publicação mais recente**; uma classificação real por relevância exigirá trabalho posterior no banco.

### Modelo e segurança

A tabela `public.jobs` mantém a chave natural única `(source, external_id)`, dados padronizados de modalidade (`remote`, `hybrid`, `onsite`, `unknown`), senioridade, contrato, localização, remuneração opcional, links e timestamps.

- **RLS** permanece habilitada para restringir a exposição de registros públicos.
- O navegador utiliza somente `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`.
- A `SUPABASE_SECRET_KEY` é **exclusiva de execução administrativa**, nunca do bundle do frontend.
- O Radar Vagas não republica a descrição integral da fonte; o candidato abre a vaga original para requisitos e inscrição.

## Instalação local

Requisitos: Node.js compatível com o projeto e dependências npm.

```powershell
git clone https://github.com/TeusCarvalho/radar-vagas-hub.git
cd radar-vagas-hub
npm.cmd install
npm.cmd run dev
```

Para testar o código do PR #1 sem tocar na `main`:

```powershell
git switch fix/recuperar-coleta-gupy-20261114
git pull --ff-only origin fix/recuperar-coleta-gupy-20261114
npm.cmd install
npm.cmd run dev
```

### Ambiente

Para consultar o Supabase no frontend local, configurar `.env.local`:

```dotenv
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

A versão de desenvolvimento usa automaticamente a **prévia local, somente leitura**, quando essas duas variáveis públicas não estiverem configuradas. Ela lê `scripts/radar-jobs.json` via servidor de desenvolvimento. Quando o Supabase estiver configurado, a página `/vagas` mostra a consulta real; `?previa=local` pode alternar para a prévia em desenvolvimento.

Para sincronização administrativa, manter a chave secreta **fora do Git**, em `.env.collector.local` ou outro arquivo local ignorado:

```dotenv
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
```

Nunca compartilhar secrets, copiar `sb_secret_` para `VITE_*` ou comitar backups/arquivos `.env.*.local`.

## Pipeline e comandos

Execute os coletores necessários ou o workflow de coleta controlada e consolide:

```powershell
node scripts/merge-jobs.mjs
node scripts/sync-supabase.mjs
```

O segundo comando **não grava dados**: executa um dry run local de consistência. Ele **não valida credenciais nem a compatibilidade do banco**.

Somente depois de backup verificado, revisão dos dados, autorização e conferência do projeto Supabase correto, a sincronização real pode ser executada:

```powershell
node scripts/sync-supabase.mjs --apply
```

**Segurança operacional atual:**

- `--apply` realiza upsert em lotes e **não desativa vagas ausentes nem exclui históricos por padrão**.
- `--deactivate-absent` é uma decisão operacional separada, para desativar as vagas não observadas; exige também `RADAR_ALLOW_DESTRUCTIVE_SYNC=YES_I_HAVE_A_VERIFIED_BACKUP`.
- `--purge-expired` exige `--deactivate-absent` e a confirmação ambiental acima, podendo excluir registros com mais de 15 dias. **Não utilizar sem backup e plano específico**.
- Não há transação global para todos os lotes: falhas intermediárias podem deixar uma carga parcial.
- O GitHub Actions agenda coletas para **08h e 18h de Brasília**, mas a execução agendada e a gravação estão **bloqueadas por padrão**. Somente habilitar a variável de repositório `RADAR_ENABLE_PRODUCTION_SYNC=true` após aprovação do fluxo automático e configuração dos secrets.

Guias: [auditoria de segurança e ações pendentes](docs/AUDITORIA_SEGURANCA_2026-11-14.md), [preparação de produção, backup e recuperação](docs/PREPARACAO_SUPABASE_PRODUCAO.md) e [histórico da recuperação](docs/RETOMADA_PIPELINE_2026-11.md).

## Qualidade, build e publicação

```powershell
npm.cmd run lint
npm.cmd run build
npm.cmd audit
```

O PR de recuperação executa testes, verificação TypeScript e compilação via GitHub Actions. Alertas `npm audit` precisam ser avaliados por dependência e alcance antes do deploy; não usar `npm audit fix --force` sem revisar quebras.

A publicação no Cloudflare exige **merge e validação do frontend**, não apenas sincronizar o banco. O processo de deploy deve ser conferido no ambiente da aplicação.

## Rotas

- `/` — página inicial
- `/vagas` — busca e filtros
- `/vagas/$jobId` — detalhe de uma vaga
- `/sobre`, `/termos`, `/privacidade` — páginas institucionais

## Aviso

O Radar Vagas é um projeto independente e não possui vínculo oficial com Gupy, InHire, Greenhouse, Lever, Ashby, InfoJobs ou com os empregadores. As marcas, informações e oportunidades pertencem aos respectivos titulares. Os anúncios de origem prevalecem quanto a requisitos, disponibilidade e candidatura.
