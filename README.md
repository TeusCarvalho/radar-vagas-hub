Radar Vagas

Hub gratuito e independente para pesquisa de vagas públicas de emprego em múltiplas plataformas de recrutamento.

Status: Beta públicoProdução: https://teuscarvalho-radar-vagas-hub.teuscarvalho.workers.dev

Sobre o projeto

O Radar Vagas é um projeto de engenharia de dados e desenvolvimento web criado para agregar, normalizar e organizar oportunidades públicas de emprego em um único catálogo.

A aplicação integra diferentes ATS (Applicant Tracking Systems), transforma schemas heterogêneos em um modelo canônico e disponibiliza as vagas em uma interface com busca e filtros.

A candidatura não acontece no Radar Vagas. O usuário é direcionado para a página oficial da oportunidade.

Fontes integradas

Atualmente o Radar Vagas integra:

Gupy

InHire

Greenhouse

Lever

Ashby

Cada fonte possui um coletor próprio, responsável por adaptar os dados nativos para o schema interno do projeto.

Pipeline

Gupy
InHire
Greenhouse
Lever
Ashby
   ↓
Coletores por fonte
   ↓
Normalização
   ↓
Janela móvel de 15 dias
   ↓
Validação
   ↓
Merge
   ↓
Deduplicação
   ↓
Supabase / PostgreSQL
   ↓
jobsRepository
   ↓
Frontend React
   ↓
Cloudflare Workers

Regra de atualização

O catálogo principal trabalha com uma janela móvel de 15 dias.

Somente vagas com data de publicação considerada confiável pela integração entram no conjunto principal.

O projeto não inventa datas ausentes.

Essa estratégia reduz vagas antigas, links obsoletos e ruído no catálogo.

Última execução validada

Execução realizada em 07/08/2026:

Fonte

Vagas válidas

Gupy

10.186

InHire

1.672

Greenhouse

432

Lever

75

Ashby

114

Total

12.479

A quantidade de vagas é dinâmica e varia a cada execução do pipeline.

Na execução acima:

12.479 registros foram processados no merge;

0 duplicidades intra-fonte foram encontradas;

0 duplicidades cross-source foram removidas pelo critério conservador atual;

0 registros ficaram inválidos após o merge;

os 12.479 registros foram enviados ao Supabase.

Normalização

As diferentes plataformas utilizam nomenclaturas e schemas distintos.

O Radar Vagas converte os dados para um contrato comum.

Modalidade

remote
hybrid
onsite
unknown

Senioridade

estagio
junior
pleno
senior
especialista
nao_informado

Contrato

clt
pj
estagio
temporario
nao_informado

O projeto evita inferências agressivas.

Por exemplo:

FullTime != CLT
Contract != PJ

Quando não existe evidência suficiente, o valor normalizado permanece como nao_informado.

Categorias profissionais

O Radar Vagas não é limitado à área de tecnologia ou dados.

O classificador atual contempla:

Dados e Analytics

Business Intelligence

Tecnologia

Produto

Comercial e Vendas

Marketing e Growth

Financeiro e Contábil

Recursos Humanos

Logística e Operações

Engenharia

Saúde

Administrativo

Atendimento e Suporte

Jurídico

Compras e Suprimentos

Educação

Negócios e Estratégia

Design

Outros

Deduplicação

O pipeline possui duas camadas de deduplicação.

Intra-fonte

Chave:

source + external_id

Entre plataformas

Critério conservador baseado na normalização exata de:

empresa + título + localização

Quando existe dúvida, o sistema prefere manter os dois registros para evitar remover vagas legítimas.

Persistência

O backend utiliza Supabase/PostgreSQL.

A chave natural utilizada no upsert é:

(source, external_id)

Campos relevantes incluem:

source
external_id
title
company
category
seniority
workplace_type
contract_type
location_text
city
state
country
salary_min
salary_max
salary_currency
salary_interval
application_url
skills
published_at
first_seen_at
last_seen_at
active

O banco utiliza Row Level Security (RLS).

Usuários públicos possuem somente acesso de leitura às vagas ativas.

As operações administrativas de sincronização utilizam chave secreta apenas no ambiente de execução dos scripts.

Privacidade e conteúdo das vagas

O Radar Vagas funciona como agregador e indexador.

Por padrão, o sistema não republica a descrição completa da vaga.

Na interface pública é exibida a mensagem:

Consulte a descrição completa, os requisitos e as condições na página oficial da vaga.

O botão de candidatura direciona o usuário para a fonte original.

Tecnologias

Frontend

React

TypeScript

TanStack Router

TanStack Query

Vite

Tailwind CSS

Radix UI

Dados e backend

Node.js

JavaScript ES Modules

Supabase

PostgreSQL

Infraestrutura

Cloudflare Workers

Wrangler

Nitro

Estrutura principal

radar-vagas-hub/
├── scripts/
│   ├── collector-standard.mjs
│   ├── collect-gupy.mjs
│   ├── collect-inhire.mjs
│   ├── collect-greenhouse.mjs
│   ├── collect-lever.mjs
│   ├── collect-ashby.mjs
│   ├── merge-jobs.mjs
│   └── sync-supabase.mjs
│
├── src/
│   ├── components/
│   ├── routes/
│   ├── services/
│   │   └── jobsRepository.ts
│   ├── types/
│   │   └── job.ts
│   └── ...
│
└── package.json

Variáveis de ambiente

Exemplo:

VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...

SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...

Importante

Nunca exponha:

SUPABASE_SECRET_KEY

em código frontend, commits, logs públicos ou variáveis com prefixo VITE_.

Arquivos locais de ambiente devem permanecer fora do Git.

Execução local

Instale as dependências:

npm install

Execute o frontend:

npm run dev

Build de produção:

npm run build

Pipeline de dados

Execute os coletores correspondentes e depois:

node scripts/merge-jobs.mjs

Teste a sincronização:

node scripts/sync-supabase.mjs

Aplicação real no Supabase:

node scripts/sync-supabase.mjs --apply

Deploy

Build:

npm run build

Deploy no Cloudflare:

npx nitro deploy --prebuilt

Rotas públicas

/
/vagas
/vagas/$jobId
/sobre
/termos
/privacidade

Objetivos técnicos demonstrados

Este projeto foi construído também como case prático de:

integração com múltiplas fontes públicas;

consumo de APIs;

engenharia de dados;

paginação em grandes volumes;

ETL;

normalização de schemas;

qualidade de dados;

deduplicação;

modelagem PostgreSQL;

sincronização idempotente;

segurança com RLS;

React e TypeScript;

arquitetura desacoplada;

deploy serverless.

Próximas evoluções

Possíveis melhorias futuras:

execução automática diária do pipeline;

filtros executados diretamente no PostgreSQL;

paginação server-side;

observabilidade dos coletores;

métricas de qualidade por fonte;

domínio próprio;

alertas e favoritos, caso o produto evolua para contas de usuário.

Aviso

O Radar Vagas é um projeto independente e não possui vínculo oficial com Gupy, InHire, Greenhouse, Lever, Ashby ou com as empresas cujas oportunidades aparecem no catálogo.

As vagas, marcas e conteúdos pertencem aos seus respectivos titulares.

A página oficial da oportunidade deve ser considerada a fonte definitiva para requisitos, condições e candidatura.