import test from "node:test";
import assert from "node:assert/strict";
import {
  JOBS_PER_PAGE, JOBS_WINDOW_DAYS, BRAZIL_STATES, JOB_CATEGORIES,
  searchTerms, searchOrFilter, buildJobsPagePlan,
} from "../../src/services/jobs-query.ts";

const now = new Date("2026-11-14T18:00:00.000Z");

test("página padrão devolve apenas vinte vagas", () => {
  const plan = buildJobsPagePlan({}, now);
  assert.equal(JOBS_PER_PAGE, 20);
  assert.equal(JOBS_WINDOW_DAYS, 7);
  assert.equal(plan.page, 1);
  assert.equal(plan.from, 0);
  assert.equal(plan.to, 19);
  assert.equal(plan.publishedAfter, "2026-11-07T18:00:00.000Z");
  assert.equal(plan.publishedBefore, "2026-11-14T18:00:00.000Z");
});

test("navegar para a segunda página consulta somente as posições 20–39", () => {
  const plan = buildJobsPagePlan({page: 2}, now);
  assert.equal(plan.from, 20);
  assert.equal(plan.to, 39);
});

test("impede tamanho de página acima do limite e corrige página inválida", () => {
  assert.equal(buildJobsPagePlan({pageSize: 500}, now).pageSize, 20);
  assert.equal(buildJobsPagePlan({page: -10}, now).page, 1);
  assert.equal(buildJobsPagePlan({page: 2, pageSize: 5}, now).to, 9);
});

test("busca por título, empresa e localização sem sintaxe especial do PostgREST", () => {
  assert.deepEqual(searchTerms("  Analista, de (Dados)  "), ["Analista", "de", "Dados"]);
  const actual = searchOrFilter(searchTerms("Analista, de (Dados)"));
  assert.ok(actual.includes("title.ilike.%Analista%"));
  assert.ok(actual.includes("company.ilike.%Dados%"));
  assert.ok(actual.includes("location_text.ilike.%Analista%"));
  assert.ok(!actual.includes("("));
  assert.ok(!actual.includes(")"));
  assert.ok(!actual.includes("title.ilike.%Analista,%"));
});

test("busca vazia não injeta condições artificiais", () => {
  assert.equal(buildJobsPagePlan({q: ""}, now).searchFilter, null);
});

test("filtros estáticos incluem Distrito Federal e classificação Dados", () => {
  assert.ok(BRAZIL_STATES.includes("DF"));
  assert.ok(JOB_CATEGORIES.includes("Dados e Analytics"));
});
