import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

for (const script of [
  "scripts/test-supabase-write.mjs",
  "scripts/import-gupy-to-supabase.mjs",
]) {
  test(`${script}: refuses an unconfirmed write command`, () => {
    const outcome = spawnSync(process.execPath, [path.join(root, script)], {
      cwd: root,
      encoding: "utf8",
      timeout: 5_000,
      // Tests never need database credentials, including in CI.
      env: {
        ...process.env,
        SUPABASE_SECRET_KEY: "",
        SUPABASE_SERVICE_ROLE_KEY: "",
      },
    });

    assert.equal(outcome.error, undefined, String(outcome.error ?? ""));
    assert.equal(outcome.status, 1);
    assert.match(outcome.stderr, /bloquead[ao]/i);
    assert.doesNotMatch(outcome.stdout, /gravada com sucesso|importa[çc][ãa]o conclu[ií]da/i);
  });
}
