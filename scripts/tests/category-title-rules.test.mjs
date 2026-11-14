import test from "node:test";
import assert from "node:assert/strict";
import { definitiveCategoryFromTitle, refineCategory } from "../category-title-rules.mjs";
import { inferStandardCategory } from "../collector-standard.mjs";

test("vendedor interno da Friboi pertence a Comercial e Vendas", () => {
  const title = "Vendedor Interno – Friboi";
  assert.equal(definitiveCategoryFromTitle(title), "Comercial e Vendas");
  assert.equal(refineCategory(title, "Produto"), "Comercial e Vendas");
  assert.equal(inferStandardCategory(title, "venda de produtos"), "Comercial e Vendas");
});

test("outros cargos comerciais explícitos prevalecem sobre palavras de produto", () => {
  for (const title of ["Vendedora Externa", "Representante Comercial", "Consultora de Vendas", "Inside Sales Representative", "Executivo de Contas", "SDR"]) {
    assert.equal(refineCategory(title, "Produto"), "Comercial e Vendas", title);
  }
});

test("não reclassifica cargos de produto sem evidência de função comercial", () => {
  for (const title of ["Product Manager", "Analista de Produto", "Designer UX/UI", "Engenheiro de Produto"]) {
    assert.equal(definitiveCategoryFromTitle(title), null, title);
    assert.equal(refineCategory(title, "Produto"), "Produto", title);
  }
});

test("preserva classificação conhecida e evita inventar categoria", () => {
  assert.equal(refineCategory("Analista de Dados", "Dados e Analytics"), "Dados e Analytics");
  assert.equal(refineCategory("Cargo sem contexto", null), "Outros");
});
