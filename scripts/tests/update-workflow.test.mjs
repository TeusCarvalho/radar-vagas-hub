import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = readFileSync(
  new URL("../../.github/workflows/atualizar-vagas.yml", import.meta.url),
  "utf8",
);

test("o acionamento manual sincroniza produção por padrão", () => {
  const dispatch = workflow.split("workflow_dispatch:")[1]?.split("\n  schedule:")[0];
  assert.ok(dispatch, "configuração workflow_dispatch ausente");
  assert.match(dispatch, /sync_production:\s*\n/);
  assert.match(dispatch, /default: true/);
  assert.match(dispatch, /type: boolean/);
});

test("cron agenda coletas duas vezes ao dia no fuso de Brasília (UTC-3)", () => {
  const cron = [...workflow.matchAll(/^\s*- cron: "([^"]+)"/gm)].map((item) => item[1]);
  assert.deepEqual(cron, ["7 11 * * *", "7 21 * * *"]);
});

test("cron e execução manual autorizada executam somente upsert", () => {
  const authorization = "github.event_name == 'schedule' || (github.event_name == 'workflow_dispatch' && inputs.sync_production == true)";
  const occurrences = workflow.split(authorization).length - 1;
  assert.equal(occurrences, 2, "ambas as etapas de credenciais e sincronização precisam da mesma proteção");
  assert.ok(workflow.includes("id: supabase_sync"));
  assert.ok(workflow.includes("run: node scripts/sync-supabase.mjs --apply"));
  assert.ok(workflow.includes("steps.supabase_sync.outcome"));
  assert.ok(!workflow.includes("run: node scripts/sync-supabase.mjs --apply --deactivate-absent"));
  assert.ok(!workflow.includes("run: node scripts/sync-supabase.mjs --apply --purge-expired"));
});

test("diagnóstico manual ainda permite execução sem gravação", () => {
  assert.ok(workflow.includes("github.event_name == 'workflow_dispatch' && inputs.sync_production != true"));
  assert.ok(workflow.includes("Modo manual de diagnóstico: nenhuma vaga foi gravada."));
});
