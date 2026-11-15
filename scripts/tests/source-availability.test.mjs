import test from "node:test";
import assert from "node:assert/strict";
import { EXPECTED_SOURCES, validateSourceCoverage } from "../source-availability.mjs";

const full = Object.fromEntries(EXPECTED_SOURCES.map((source) => [source, 10]));

test("permite catálogo completo e marca sincronização integral", () => {
  assert.deepEqual(validateSourceCoverage(full), { partial: false, missing: [] });
});

test("permite somente InfoJobs ausente quando fallback explícito está ativo", () => {
  const counts = { ...full, infojobs: 0 };
  assert.deepEqual(validateSourceCoverage(counts, { allowMissingInfojobs: true }), {
    partial: true, missing: ["infojobs"],
  });
  assert.throws(() => validateSourceCoverage(counts), /infojobs/);
});

test("bloqueia qualquer outra fonte ausente, mesmo no fallback do InfoJobs", () => {
  assert.throws(
    () => validateSourceCoverage({ ...full, gupy: 0, infojobs: 0 }, { allowMissingInfojobs: true }),
    /gupy/,
  );
  assert.throws(
    () => validateSourceCoverage({ ...full, gupy: 0 }, { allowMissingInfojobs: true }),
    /gupy/,
  );
});

test("bloqueia fallback contraditório e fontes inesperadas", () => {
  assert.throws(() => validateSourceCoverage(full, { allowMissingInfojobs: true }), /Flag de fallback/);
  assert.throws(() => validateSourceCoverage({ ...full, unknown: 1 }), /desconhecidas/);
  assert.throws(() => validateSourceCoverage({ ...full, infojobs: -1 }), /Contagem inválida/);
});
