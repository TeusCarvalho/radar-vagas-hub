// Smoke test HTTP somente de leitura (sem acesso ao Supabase).
import { buildGupySearchUrl, extractGupyRows } from "./gupy-api.mjs";

const url = buildGupySearchUrl(0, 2);
const response = await fetch(url, {
  headers: { Accept: "application/json", "User-Agent": "Radar-Vagas/1.0" },
  signal: AbortSignal.timeout(15_000),
});
if (!response.ok) {
  throw new Error(`Smoke Gupy: HTTP ${response.status} ${response.statusText}`);
}
const rows = extractGupyRows(await response.json());
if (rows.length === 0) {
  throw new Error("Smoke Gupy: API retornou data vazia.");
}
for (const row of rows) {
  if (!row.id || !row.name || !row.jobUrl || !row.publishedDate) {
    throw new Error("Smoke Gupy: faltam campos obrigatórios (id/name/jobUrl/publishedDate).");
  }
  const host = new URL(row.jobUrl).hostname.toLowerCase();
  if (!(host === "gupy.io" || host.endsWith(".gupy.io"))) {
    throw new Error("Smoke Gupy: URL de candidatura fora do domínio gupy.io.");
  }
}
console.log(`Smoke Gupy OK: ${rows.length} vagas e contrato de dados válidos.`);
