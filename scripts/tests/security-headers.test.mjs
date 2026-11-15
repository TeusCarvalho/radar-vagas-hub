import test from "node:test";
import assert from "node:assert/strict";
import { withSecurityHeaders } from "../../src/lib/security-headers.ts";

test("inclui cabeçalhos defensivos sem perder status, corpo e tipo de conteúdo", async () => {
  const original = new Response("<html>Radar Vagas</html>", {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
  const result = withSecurityHeaders(original);

  assert.equal(result.status, 200);
  assert.equal(result.headers.get("content-type"), "text/html; charset=utf-8");
  assert.equal(result.headers.get("cache-control"), "no-store");
  assert.equal(result.headers.get("x-content-type-options"), "nosniff");
  assert.equal(result.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.equal(result.headers.get("x-frame-options"), "DENY");
  assert.equal(result.headers.get("permissions-policy"), "camera=(), microphone=(), geolocation=()");
  assert.equal(result.headers.get("strict-transport-security"), "max-age=31536000");
  assert.equal(await result.text(), "<html>Radar Vagas</html>");
});

test("protege também respostas de erro sem convertê-las em status 200", async () => {
  const response = new Response("Falha temporária", { status: 503 });
  const result = withSecurityHeaders(response);

  assert.equal(result.status, 503);
  assert.equal(result.headers.get("x-content-type-options"), "nosniff");
  assert.equal(await result.text(), "Falha temporária");
});

test("preserva Content-Security-Policy quando outra camada definir a política", async () => {
  const response = new Response("ok", {
    status: 200,
    headers: { "Content-Security-Policy": "default-src 'self'" },
  });
  const result = withSecurityHeaders(response);
  assert.equal(result.headers.get("content-security-policy"), "default-src 'self'");
});
