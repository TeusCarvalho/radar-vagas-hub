# Paginação server-side do Radar Vagas

## Motivo

A versão anterior recuperava até todo o catálogo ativo por lotes de 1.000
vagas e filtrava/ordenava/paginava no navegador. A estratégia gerava alta
latência, principalmente com milhares de oportunidades.

## Solução na branch fix/recuperar-coleta-gupy-20261114

- "src/services/jobsRepository.ts" utiliza uma consulta Supabase/PostgREST
  diretamente em "public.jobs" com "active = true" e recência de 7 dias.
- Cada consulta aplica filtros (modalidade, senioridade, UF, categoria,
  contrato, origem) **no banco**, junto da pesquisa textual por título,
  empresa, categoria, localização e cidade.
- A API retorna no máximo 20 resultados, usando range(página*20) e
  count: exact para informar o total.
- Ordenação estável por published_at desc, id asc, evitando páginas
  instáveis quando datas coincidem.
- A página de detalhe usa .eq(id).maybeSingle(), sem carregar o catálogo todo.
- O menu de categorias e UFs usa os valores padronizados conhecidos do pipeline,
  sem uma consulta separada de milhares de registros.
- O filtro antigo "Relevância" foi ocultado até existir ranqueamento real no
  PostgreSQL. A busca permanece ordenada pelas publicações mais recentes.
- A interface informa que um catálogo sem vagas recentes pode aguardar
  atualização, em vez de afirmar que não existem oportunidades.

## Limitações reconhecidas

- A busca textual por "ilike" privilegia os campos de título, empresa,
  categoria e localização. Busca por competências no array "skills" e
  ranqueamento por relevância exigirão índice/consulta específica no banco.
- As UFs do filtro representam os estados brasileiros. Localizações
  internacionais exigirão estratégia distinta de seleção de país/região.
- A contagem "exact" pode exigir otimização adicional com aumento de escala.
  O índice existente "rv_jobs_active_published_idx" já cobre active +
  published_at para filtragem inicial de datas.
- O Supabase de produção ainda possui zero vagas publicadas nos últimos 7 dias
  (consulta read-only de 14/11/2026). Portanto o site mostrará o estado
  vazio até que uma sincronização **segura** ocorra.

## Bloqueador de sincronização — atenção

A constraint atual do banco "public.jobs" chamada "rv_jobs_source_ck" autoriza
apenas gupy, inhire, greenhouse, lever e ashby. **Não autoriza InfoJobs**,
embora o novo catálogo local contenha 9.865 vagas dessa plataforma.

Antes de rodar "sync-supabase.mjs --apply" será necessário tratar essa
incompatibilidade com migração revisada, além de realizar backup e um plano
de reversão. Não remover constraints nem executar sincronização parcial
automaticamente.

## Como testar sem gravar no Supabase

1. "git pull --ff-only origin fix/recuperar-coleta-gupy-20261114"
2. "node --test scripts/tests/*.test.mjs"
3. "npm.cmd run build"
4. "npm.cmd run dev" — abrir /vagas.
5. Acessar /vagas?pagina=2: o navegador envia uma consulta com range 20-39.
6. Alterar filtros: o contador e a página devem refletir os filtros no banco;
   ao mudar filtro, a paginação volta a 1.
7. Sem vagas recentes no Supabase, verificar a mensagem de catálogo aguardando
   atualização. Não cadastrar vagas fictícias em produção para testar.
