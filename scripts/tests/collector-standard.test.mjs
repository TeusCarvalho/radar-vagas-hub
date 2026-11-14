import test from "node:test";
import assert from "node:assert/strict";
import { WINDOW_DAYS, isWithinWindow, parseDate } from "../collector-standard.mjs";

test("janela padrão da InHire/InfoJobs é 15 dias", () => {
  assert.equal(WINDOW_DAYS, 15);
});

test("aceita vaga publicada há 10 dias e rejeita vaga com 16 dias", () => {
  const now = Date.now();
  assert.equal(isWithinWindow(new Date(now - 10 * 86400000).toISOString()), true);
  assert.equal(isWithinWindow(new Date(now - 16 * 86400000).toISOString()), false);
});

test("não inventa datas ausentes ou inválidas", () => {
  assert.equal(parseDate(null), null);
  assert.equal(parseDate("data-invalida"), null);
  assert.equal(isWithinWindow(null), false);
  assert.equal(isWithinWindow("data-invalida"), false);
});
