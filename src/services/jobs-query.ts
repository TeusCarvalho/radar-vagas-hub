import type { JobQuery } from "@/types/job";

export const JOBS_PER_PAGE = 20;
export const JOBS_WINDOW_DAYS = 7;
const DAY_MS = 86_400_000;

// Os filtros exibem valores padronizados do pipeline; não consultam milhares
// de linhas da tabela apenas para construir os menus.
export const BRAZIL_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO",
  "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI",
  "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

export const JOB_CATEGORIES = [
  "Dados e Analytics", "Business Intelligence", "Tecnologia", "Produto",
  "Comercial e Vendas", "Marketing e Growth", "Financeiro e Contábil",
  "Recursos Humanos", "Logística e Operações", "Engenharia", "Saúde",
  "Administrativo", "Atendimento e Suporte", "Jurídico",
  "Compras e Suprimentos", "Educação", "Negócios e Estratégia",
  "Design", "Outros",
].sort((a, b) => a.localeCompare(b, "pt-BR"));

// .or() usa sintaxe PostgREST diretamente: removemos tokens especiais para
// não permitir que o termo de busca introduza operadores ou filtros.
export function searchTerms(value: string | undefined): string[] {
  return String(value ?? "")
    .normalize("NFKC")
    .slice(0, 120)
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6);
}

export function searchOrFilter(terms: string[]): string | null {
  if (terms.length === 0) return null;

  const searchableColumns = ["title", "company", "category", "location_text", "city"];
  return terms.flatMap(
    (term) => searchableColumns.map((field) => field + ".ilike.%" + term + "%"),
  ).join(",");
}

export function buildJobsPagePlan(
  query: JobQuery,
  now = new Date(),
) {
  const requestedPage = Number(query.page);
  const page = Number.isSafeInteger(requestedPage) && requestedPage >= 1
    ? Math.min(requestedPage, 100_000)
    : 1;
  const requestedSize = Number(query.pageSize);
  const pageSize = Number.isSafeInteger(requestedSize)
    ? Math.min(Math.max(1, requestedSize), JOBS_PER_PAGE)
    : JOBS_PER_PAGE;

  const from = (page - 1) * pageSize;
  const nowMs = now.getTime();
  const terms = searchTerms(query.q);

  return {
    page,
    pageSize,
    from,
    to: from + pageSize - 1,
    publishedBefore: now.toISOString(),
    publishedAfter: new Date(nowMs - JOBS_WINDOW_DAYS * DAY_MS).toISOString(),
    searchFilter: searchOrFilter(terms),
  };
}
