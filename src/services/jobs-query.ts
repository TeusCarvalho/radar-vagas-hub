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

// A pesquisa ignora conectivos comuns (ex.: "Analista de Dados") e
// exige todas as palavras relevantes, mesmo que estejam em colunas diferentes.
// Tokens são saneados antes de entrar na sintaxe PostgREST.
const STOP_WORDS = new Set(["a", "o", "as", "os", "de", "da", "do", "das", "dos",
  "e", "em", "com", "para", "por", "no", "na", "nos", "nas", "um", "uma"]);

export function searchTerms(value: string | undefined): string[] {
  const tokens = String(value ?? "")
    .normalize("NFKC")
    .slice(0, 120)
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const meaningful = tokens.filter((term) => !STOP_WORDS.has(term.toLowerCase()));
  return (meaningful.length > 0 ? meaningful : tokens).slice(0, 6);
}

export function searchOrFilter(terms: string[]): string | null {
  if (terms.length === 0) return null;

  const columns = ["title", "company", "category", "location_text", "city"];
  const alternatives = (term: string) =>
    columns.map((column) => `${column}.ilike.%${term}%`).join(",");

  if (terms.length === 1) return alternatives(terms[0]!);

  // .or('and(or(...),or(...))') agrupa alternativas por token e exige todos.
  return `and(${terms.map((term) => `or(${alternatives(term)})`).join(",")})`;
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
