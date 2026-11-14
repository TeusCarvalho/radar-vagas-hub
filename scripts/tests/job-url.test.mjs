import test from "node:test";
import assert from "node:assert/strict";
import { safeJobApplicationUrl } from "../../src/lib/job-url.ts";

test("permite links HTTP e HTTPS para candidaturas", () => {
  assert.equal(safeJobApplicationUrl("https://empresa.example/vaga/1"), "https://empresa.example/vaga/1");
  assert.equal(safeJobApplicationUrl("http://exemplo.test/jobs"), "http://exemplo.test/jobs");
});

test("bloqueia protocolos e URLs inválidas recebidas das fontes externas", () => {
  for (const value of [
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "//site.example/vaga",
    "file:///etc/passwd",
    "/jobs/1",
    "",
    null,
    undefined,
  ]) {
    assert.equal(safeJobApplicationUrl(value), null, String(value));
  }
});
