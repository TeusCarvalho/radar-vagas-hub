import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

const CATALOG_FILE = fileURLToPath(new URL("./radar-jobs.json", import.meta.url));
const DAY_MS = 86_400_000;
let snapshot = null;
let lastMtime = -1;
let loading = null;

const normalize = (value) => String(value ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .trim();

export function selectPreviewPage(jobs, params, nowMs = Date.now()) {
  const pageInput = Number(params.get("page") ?? 1);
  const page = Number.isSafeInteger(pageInput) && pageInput > 0
    ? Math.min(pageInput, 100_000)
    : 1;
  const terms = normalize(String(params.get("q") ?? "").slice(0, 120))
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6);

  const filters = ["workplaceType", "seniority", "state", "category", "contractType", "source"];
  const columns = ["workplace_type", "seniority", "state", "category", "contract_type", "source"];
  const cutoffMs = nowMs - 7 * DAY_MS;

  const filtered = jobs.filter((job) => {
    if (job?.active === false) return false;
    const publishedMs = Date.parse(job?.published_at ?? "");
    if (!Number.isFinite(publishedMs) || publishedMs < cutoffMs || publishedMs > nowMs) {
      return false;
    }
    for (let index = 0; index < filters.length; index++) {
      const selected = params.get(filters[index]);
      if (selected && selected !== "todos" && selected !== job[columns[index]]) {
        return false;
      }
    }
    if (terms.length) {
      const text = normalize([
        job.title, job.company, job.category, job.location_text, job.city,
        ...(Array.isArray(job.skills) ? job.skills : []),
      ].join(" "));
      if (!terms.every((term) => text.includes(term))) return false;
    }
    return true;
  });

  filtered.sort((a, b) =>
    (Date.parse(b.published_at) - Date.parse(a.published_at)) ||
    String(a.source).localeCompare(String(b.source)) ||
    String(a.external_id).localeCompare(String(b.external_id)),
  );

  const from = (page - 1) * 20;
  return { total: filtered.length, jobs: filtered.slice(from, from + 20), page };
}

async function getCatalog() {
  const metadata = await fs.stat(CATALOG_FILE);
  if (snapshot && lastMtime === metadata.mtimeMs) return snapshot;
  if (loading) return loading;
  loading = fs.readFile(CATALOG_FILE, "utf8")
    .then((source) => {
      const parsed = JSON.parse(source);
      if (!Array.isArray(parsed)) {
        throw new Error("O arquivo radar-jobs.json não contém uma lista.");
      }
      snapshot = parsed;
      lastMtime = metadata.mtimeMs;
      return parsed;
    })
    .finally(() => { loading = null; });
  return loading;
}

/**
 * Endpoint EXCLUSIVO do servidor Vite de desenvolvimento. Faz a paginação
 * antes de enviar os registros; não escreve no Supabase nem publica o JSON
 * inteiro no bundle de produção.
 */
export function radarLocalPreviewPlugin() {
  return {
    name: "radar-local-catalog-preview",
    configureServer(server) {
      server.middlewares.use("/api/radar-preview/jobs", async (req, res) => {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");

        if (req.method !== "GET") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "Método não permitido." }));
          return;
        }

        try {
          const params = new URL(req.url ?? "/", "http://localhost").searchParams;
          const jobs = await getCatalog();
          res.statusCode = 200;
          res.end(JSON.stringify(selectPreviewPage(jobs, params)));
        } catch (error) {
          res.statusCode = error?.code === "ENOENT" ? 404 : 500;
          const message = error?.code === "ENOENT"
            ? "O catálogo local scripts/radar-jobs.json não existe. Execute node scripts/merge-jobs.mjs."
            : "Não foi possível ler o catálogo local: " + String(error?.message ?? error);
          res.end(JSON.stringify({ error: message }));
        }
      });
    },
  };
}
