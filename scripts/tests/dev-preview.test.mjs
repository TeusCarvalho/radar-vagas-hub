import test from "node:test";
import assert from "node:assert/strict";
import { selectPreviewPage } from "../dev-preview-plugin.mjs";

const TODAY = Date.parse("2026-11-14T18:00:00Z");
function fixture(n, days = 1) {
  return {
    source: n % 2 ? "infojobs" : "gupy",
    external_id: String(n),
    title: "Analista de Dados " + n,
    company: n % 2 ? "Empresa confidencial" : "Empresa real",
    workplace_type: n % 2 ? "remote" : "onsite",
    seniority: "pleno",
    state: "DF",
    contract_type: "clt",
    category: "Dados e Analytics",
    published_at: new Date(TODAY - days * 86_400_000).toISOString(),
    application_url: "https://example.org/job/" + n,
  };
}

test("prévia local pagina sem publicar o JSON completo", () => {
  const jobs = Array.from({length: 51}, (_, i) => fixture(i));
  assert.equal(selectPreviewPage(jobs, new URLSearchParams(), TODAY).jobs.length, 20);
  const second = selectPreviewPage(jobs, new URLSearchParams("page=2"), TODAY);
  assert.equal(second.total, 51);
  assert.equal(second.jobs.length, 20);
  const third = selectPreviewPage(jobs, new URLSearchParams("page=3"), TODAY);
  assert.equal(third.jobs.length, 11);
});

test("prévia respeita os sete dias, modalidade e pesquisa", () => {
  const records = [fixture(1), fixture(2, 8), fixture(3)];
  const all = selectPreviewPage(records, new URLSearchParams(), TODAY);
  assert.equal(all.total, 2);
  const remote = selectPreviewPage(records, new URLSearchParams("workplaceType=remote&q=Dados"), TODAY);
  assert.equal(remote.total, 2);
  assert.ok(remote.jobs.every((job) => job.workplace_type === "remote"));
  const onsite = selectPreviewPage(records, new URLSearchParams("workplaceType=onsite"), TODAY);
  assert.equal(onsite.total, 0);
});
