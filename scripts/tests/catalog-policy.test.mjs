import test from "node:test";
import assert from "node:assert/strict";
import {
  CATALOG_WINDOW_DAYS,
  UNDISCLOSED_COMPANY_LABEL,
  isUnidentifiedCompany,
  publicCompanyName,
  publicationExclusionReason,
} from "../catalog-policy.mjs";

const NOW = Date.parse("2026-11-14T18:00:00.000Z");
const DAY = 86_400_000;
function job(source, days, provenance, company = "Empresa Exemplo") {
  return {
    source, external_id: "v123", title: "Analista de Dados", company,
    published_at: new Date(NOW - days * DAY).toISOString(),
    published_at_source: provenance,
  };
}

test("aplica 7 dias a todas as fontes, inclusive Gupy e Greenhouse", () => {
  assert.equal(CATALOG_WINDOW_DAYS, 7);
  assert.equal(publicationExclusionReason(job("gupy", 6, null), NOW, "gupy"), null);
  assert.equal(publicationExclusionReason(job("greenhouse", 10, "first_published"), NOW), "outside_window");
  assert.equal(publicationExclusionReason(job("lever", 7, "createdAt"), NOW), null);
  assert.equal(publicationExclusionReason(job("ashby", 8, "publishedAt"), NOW), "outside_window");
});

test("não aceita datas faltantes, inválidas ou futuras", () => {
  assert.equal(publicationExclusionReason({...job("gupy", 1, null), published_at: null}, NOW), "missing_publication_date");
  assert.equal(publicationExclusionReason({...job("gupy", 1, null), published_at: "invalida"}, NOW), "invalid_publication_date");
  assert.equal(publicationExclusionReason(job("gupy", -1, null), NOW), "future_publication_date");
});

test("não confunde atualização ou primeira observação com publicação", () => {
  assert.equal(publicationExclusionReason(job("greenhouse", 2, "updated_at_fallback"), NOW), "unverified_publication_date");
  assert.equal(publicationExclusionReason(job("lever", 2, "first_seen_fallback"), NOW), "unverified_publication_date");
  assert.equal(publicationExclusionReason(job("greenhouse", 2, "first_published"), NOW), null);
  assert.equal(publicationExclusionReason(job("lever", 2, "createdAt"), NOW), null);
});

test("permite proveniência válida para as seis plataformas", () => {
  const sources = [
    ["gupy", ""],
    ["inhire", "inhire_publication_or_created"],
    ["inhire", "inhire_published_cache"],
    ["greenhouse", "first_published"],
    ["lever", "createdAt"],
    ["ashby", "publishedAt"],
    ["infojobs", "infojobs_listing_js_date"],
    ["infojobs", "infojobs_jobposting_datePosted"],
  ];
  for (const [source, provenance] of sources) {
    assert.equal(publicationExclusionReason(job(source, 1, provenance), NOW, source), null, source);
  }
});

test("mantém vagas InfoJobs de empresa desconhecida e rotula somente para exibição", () => {
  assert.equal(isUnidentifiedCompany("Empresa não informada"), true);
  assert.equal(isUnidentifiedCompany("Confidencial"), true);
  assert.equal(publicCompanyName("infojobs", "Empresa não informada"), UNDISCLOSED_COMPANY_LABEL);
  assert.equal(publicCompanyName("infojobs", "Empresa Exemplo"), "Empresa Exemplo");
  assert.equal(publicCompanyName("gupy", "Empresa não informada"), "Empresa não informada");
  assert.equal(publicationExclusionReason(job("infojobs", 1, "infojobs_listing_js_date", "Empresa não informada"), NOW), null);
});

test("rejeita fontes incompatíveis com o arquivo de origem", () => {
  assert.equal(publicationExclusionReason(job("gupy", 1, null), NOW, "inhire"), "source_mismatch");
  assert.equal(publicationExclusionReason(job("fonte-que-nao-existe", 1, null), NOW), "unknown_source");
});
