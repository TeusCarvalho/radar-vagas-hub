// Auditoria leve e nao destrutiva do site publico.
// Apenas requisicoes GET; sem SQL, credenciais, mutacoes ou carga.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const base = "https://teuscarvalho-radar-vagas-hub.teuscarvalho.workers.dev";
const headersExpected = [
  ["x-content-type-options", /^nosniff$/i],
  ["x-frame-options", /^deny$/i],
  ["referrer-policy", /strict-origin-when-cross-origin/i],
  ["permissions-policy", /camera=\(\),\s*microphone=\(\),\s*geolocation=\(\)/i],
  ["strict-transport-security", /max-age=\d+/i],
];
let failures = 0;

async function check(path, label, testReflectedMarkup = false) {
  const url = new URL(path, base);
  const res = await fetch(url, {
    method: "GET",
    headers: { accept: "text/html" },
    redirect: "follow",
    signal: AbortSignal.timeout(25000),
  });
  const html = await res.text();
  const final = new URL(res.url);
  const problems = [];
  if (res.status !== 200) problems.push("HTTP " + res.status);
  if (final.origin !== base) problems.push("redirect externo " + final.origin);
  if (!res.headers.get("content-type")?.includes("text/html")) {
    problems.push("content-type nao HTML");
  }

  for (const [name, rule] of headersExpected) {
    const value = res.headers.get(name);
    console.log("HEADER " + label + " " + name + ": " + (value ?? "(ausente)"));
    if (!value || !rule.test(value)) problems.push("header incorreto: " + name);
  }
  const csp = res.headers.get("content-security-policy");
  console.log("CSP " + label + ": " + (csp ?? "AUSENTE (recomendacao, nao falha bloqueante)"));

  if (testReflectedMarkup) {
    // Avalia apenas se a resposta HTML ja contem elementos executaveis originados
    // na busca. Nao e uma prova exaustiva de ausencia de DOM XSS.
    if (/<img\b[^>]*\bonerror\s*=/i.test(html)) problems.push("markup img/onerror nao escapado");
    if (/<svg\b[^>]*\bonload\s*=/i.test(html)) problems.push("markup svg/onload nao escapado");
    if (/<script\b[^>]*>\s*alert\s*\(/i.test(html)) problems.push("script injetado nao escapado");
  }
  if (problems.length) {
    failures += 1;
    console.error("FALHOU " + label + ": " + problems.join("; "));
  } else {
    console.log("PASSOU " + label + ": HTTP 200, headers basicos corretos, corpo HTML recebido");
  }
}

for (const file of [
  "src/components/job-card.tsx",
  "src/routes/vagas.tsx",
  "src/routes/vagas_.$jobId.tsx",
]) {
  const source = readFileSync(file, "utf8");
  const unsafeSink = /dangerouslySetInnerHTML|\.\s*innerHTML\s*=|document\.write\s*\(/;
  assert.equal(unsafeSink.test(source), false, "sink potencialmente inseguro em " + file);
  console.log("PASSOU checagem estatica de sinks: " + file);
}

await check("/", "homepage");
await check("/vagas", "catalogo");
const payloads = [
  '<img src=x onerror=alert("RADAR_XSS_TEST")>',
  '<svg onload=alert("RADAR_XSS_TEST")>',
  '"><script>alert("RADAR_XSS_TEST")</script>',
];
for (let i = 0; i < payloads.length; i++) {
  await check("/vagas?q=" + encodeURIComponent(payloads[i]), "XSS-refletido-" + (i + 1), true);
}
if (failures > 0) {
  console.error("Auditoria HTTP/XSS refletido: " + failures + " testes falharam.");
  process.exitCode = 1;
} else {
  console.log("Auditoria HTTP/XSS refletido: verificacoes executadas sem falhas detectadas.");
}
