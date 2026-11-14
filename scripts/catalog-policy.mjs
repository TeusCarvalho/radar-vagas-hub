import { WINDOW_DAYS } from "./collector-standard.mjs";

// A política do catálogo é uniforme mesmo que uma fonte tenha estratégia de
// busca diferente. Não altera o timestamp de publicação disponibilizado na fonte.
export const CATALOG_WINDOW_DAYS = WINDOW_DAYS;
const DAY_MS = 86_400_000;

const TRUSTED_DATE_SOURCES = {
  gupy: new Set([""]),
  inhire: new Set(["inhire_publication_or_created", "inhire_published_cache"]),
  greenhouse: new Set(["first_published"]),
  lever: new Set(["createdAt"]),
  ashby: new Set(["publishedAt"]),
  infojobs: new Set(["infojobs_listing_js_date", "infojobs_jobposting_datePosted"]),
};

// Rótulo solicitado para o catálogo. Este rótulo significa que a fonte não
// identificou a empresa, NÃO que o empregador confirmou confidencialidade.
export const UNDISCLOSED_COMPANY_LABEL = "Empresa confidencial";

function normalizedCompany(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function isUnidentifiedCompany(value) {
  return new Set([
    "", "empresa nao informada", "empresa nao identificado",
    "empresa confidencial", "confidencial", "nao informado", "nao informada",
  ]).has(normalizedCompany(value));
}

export function publicCompanyName(source, company) {
  if (source === "infojobs" && isUnidentifiedCompany(company)) {
    return UNDISCLOSED_COMPANY_LABEL;
  }
  return String(company ?? "").trim();
}

export function publicationExclusionReason(job, nowMs = Date.now(), expectedSource = null) {
  if (!job || typeof job !== "object" || Array.isArray(job)) return "invalid_job";
  const source = String(job.source ?? "").trim();
  if (!Object.hasOwn(TRUSTED_DATE_SOURCES, source)) return "unknown_source";
  if (expectedSource !== null && source !== expectedSource) return "source_mismatch";

  const published = job.published_at;
  if (typeof published !== "string" || !published.trim()) return "missing_publication_date";
  const timestamp = Date.parse(published);
  if (!Number.isFinite(timestamp)) return "invalid_publication_date";
  if (timestamp > nowMs) return "future_publication_date";
  if (nowMs - timestamp > CATALOG_WINDOW_DAYS * DAY_MS) return "outside_window";

  const provenance = String(job.published_at_source ?? "").trim();
  if (!TRUSTED_DATE_SOURCES[source].has(provenance)) {
    return "unverified_publication_date";
  }
  return null;
}
