// Teste de carga limitado do Worker do próprio projeto (não é pentest).
// Limites imutáveis: 65 requisições GET, pico de 30 simultâneas, 8 s por request.
// NÃO alterar para atacar serviços terceiros ou originar tráfego ilimitado.
import fs from "node:fs";

const BASE = "https://teuscarvalho-radar-vagas-hub.teuscarvalho.workers.dev";
const ROUTES = [
  "/vagas",
  "/vagas?q=Analista%20de%20Dados&modalidade=remote&pagina=1",
];
const CONCURRENCY_STAGES = [5, 10, 20, 30];
const MAX_REQUESTS = 65;
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_P95_MS = 5_000;
const WAIT_BETWEEN_STAGES_MS = 1_000;
const MAX_STAGE_ERROR_RATE = 0;

if (CONCURRENCY_STAGES.reduce((a, b) => a + b, 0) > MAX_REQUESTS) {
  throw new Error("Limite absoluto de requisições excedido. Teste abortado.");
}

function percentile(values, pct) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * pct) - 1)];
}

let total = 0;
let errors = 0;
let peakInFlight = 0;
let inFlight = 0;
const table = [];

async function probe(index) {
  const url = new URL(ROUTES[index % ROUTES.length], BASE);
  const start = performance.now();
  inFlight++;
  peakInFlight = Math.max(peakInFlight, inFlight);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "text/html", "User-Agent": "RadarVagas-AuthorizedLoadTest/1.0" },
      redirect: "error",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
    const html = await response.text();
    const latencyMs = Math.round(performance.now() - start);
    const contentType = response.headers.get("content-type") ?? "";
    const ok = response.status === 200 &&
      contentType.includes("text/html") &&
      /radar\\s+vagas/i.test(html) &&
      !/Just a moment\\.\\.\\.|Error 1020/i.test(html);
    return { ok, status: response.status, latencyMs };
  } catch (error) {
    return {
      ok: false,
      status: "network-error",
      latencyMs: Math.round(performance.now() - start),
      detail: error instanceof Error ? error.message : String(error),
    };
  } finally {
    inFlight--;
  }
}

for (const concurrency of CONCURRENCY_STAGES) {
  const start = performance.now();
  const results = await Promise.all(
    Array.from({ length: concurrency }, (_, index) => probe(total + index)),
  );
  const elapsedMs = Math.max(1, performance.now() - start);
  total += results.length;

  const failures = results.filter((x) => !x.ok);
  const latencies = results.map((x) => x.latencyMs);
  const p50 = percentile(latencies, 0.5);
  const p95 = percentile(latencies, 0.95);
  const throughput = Number((results.length / (elapsedMs / 1_000)).toFixed(1));
  errors += failures.length;
  table.push({ concurrent: concurrency, requests: results.length, errors: failures.length, p50, p95, throughput });
  console.log(
    `stage=${concurrency} req=${results.length} fail=${failures.length} p50=${p50}ms p95=${p95}ms throughput=${throughput} req/s`,
  );

  if (failures.length > 0) {
    for (const failure of failures.slice(0, 3)) console.error("Failure sample:", failure);
  }

  // Interromper imediatamente se o serviço não sustentar uma etapa.
  if (failures.length / results.length > MAX_STAGE_ERROR_RATE || p95 > MAX_P95_MS) {
    console.error(`INTERRUPÇÃO por segurança: falhas=${failures.length}, p95=${p95}ms (máximo ${MAX_P95_MS}ms).`);
    break;
  }

  if (concurrency !== CONCURRENCY_STAGES.at(-1)) {
    await new Promise((resolve) => setTimeout(resolve, WAIT_BETWEEN_STAGES_MS));
  }
}

console.log("FINAL", JSON.stringify({ total, errors, peakInFlight, stages: table }));
if (process.env.GITHUB_STEP_SUMMARY) {
  let md = "## Radar Vagas — teste de carga limitado\\n\\n";
  md += "Somente GET no Worker; limite de 65 solicitações e 30 concorrentes.\\n\\n";
  md += "| Concorrência | Requisições | Falhas | p50 | p95 | req/s |\\n";
  md += "|---:|---:|---:|---:|---:|---:|\\n";
  for (const v of table) {
    md += `| ${v.concurrent} | ${v.requests} | ${v.errors} | ${v.p50} ms | ${v.p95} ms | ${v.throughput} |\\n`;
  }
  md += "\\nEste teste não simula navegadores reais nem chamadas Supabase feitas pelo cliente.\\n";
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
}

if (errors > 0 || table.length !== CONCURRENCY_STAGES.length) process.exitCode = 1;
