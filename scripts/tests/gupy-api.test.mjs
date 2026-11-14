import test from "node:test";
import assert from "node:assert/strict";
import { buildGupySearchUrl, extractGupyRows, GUPY_SEARCH_URL } from "../gupy-api.mjs";

test("usa o endpoint novo, HTTPS, sem parâmetros obsoletos", () => {
  const url = new URL(buildGupySearchUrl(100, 100, { type: "vacancy_type_effective", workplaceType: "remote" }));
  assert.equal(url.origin + url.pathname, GUPY_SEARCH_URL);
  assert.equal(url.protocol, "https:");
  assert.equal(url.searchParams.get("offset"), "100");
  assert.equal(url.searchParams.get("limit"), "100");
  assert.equal(url.searchParams.get("type"), "vacancy_type_effective");
  assert.equal(url.searchParams.get("workplaceType"), "remote");
  assert.equal(url.searchParams.has("sortBy"), false);
});

test("respeita o limite de paginação da API", () => {
  assert.throws(() => buildGupySearchUrl(10_000, 100), RangeError);
  assert.throws(() => buildGupySearchUrl(0, 101), RangeError);
  assert.throws(() => buildGupySearchUrl(0, 100, { secret: "x" }), /não suportado/);
});

test("aceita resultados vazios válidos, mas não formatos inesperados", () => {
  assert.deepEqual(extractGupyRows({ data: [] }), []);
  assert.deepEqual(extractGupyRows({ data: [{ id: 123 }] }), [{ id: 123 }]);
  assert.throws(() => extractGupyRows({ results: [] }), /formato inesperado/);
  assert.throws(() => extractGupyRows(null), /formato inesperado/);
});
