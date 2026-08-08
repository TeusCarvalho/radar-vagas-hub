import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

const INPUT_FILE = path.join(__dirname, "radar-jobs.json");
const BATCH_SIZE = 400;
const WINDOW_DAYS = 15;

const EXPECTED_SOURCES = ["gupy", "inhire", "greenhouse", "lever", "ashby"];

const STATUS_TABLE = "radar_status";
const STATUS_ROW_ID = "main";

async function loadEnvFile(file) {
  try {
    const raw = await fs.readFile(file, "utf8");

    for (const originalLine of raw.split(/\r?\n/)) {
      const line = originalLine.trim();

      if (!line || line.startsWith("#")) {
        continue;
      }

      const index = line.indexOf("=");

      if (index <= 0) {
        continue;
      }

      const key = line.slice(0, index).trim();
      let value = line.slice(index + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }

    return true;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

async function loadProjectEnv() {
  const candidates = [
    path.join(PROJECT_ROOT, ".env.local"),
    path.join(PROJECT_ROOT, ".env.collector.local"),
    path.join(PROJECT_ROOT, ".env.production"),
    path.join(PROJECT_ROOT, ".env"),
  ];

  for (const file of candidates) {
    await loadEnvFile(file);
  }
}

function requiredConfig() {
  const url =
    process.env.SUPABASE_URL ??
    process.env.VITE_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("SUPABASE_URL não encontrada. Pode usar também VITE_SUPABASE_URL.");
  }

  if (!secret) {
    throw new Error(
      [
        "SUPABASE_SECRET_KEY não encontrada.",
        "Crie uma Secret Key no Supabase e coloque somente em .env.local.",
        "Não use VITE_ ou NEXT_PUBLIC_ no nome da chave secreta.",
      ].join(" "),
    );
  }

  if (
    secret.startsWith("sb_publishable_") ||
    secret === process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    secret === process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    throw new Error(
      "Foi fornecida uma Publishable Key. O sincronizador exige SUPABASE_SECRET_KEY.",
    );
  }

  return { url, secret };
}

async function readJobs() {
  const raw = await fs.readFile(INPUT_FILE, "utf8");
  const jobs = JSON.parse(raw);

  if (!Array.isArray(jobs)) {
    throw new Error("radar-jobs.json não contém um array.");
  }

  return jobs;
}

function countSources(jobs) {
  const counts = Object.fromEntries(EXPECTED_SOURCES.map((source) => [source, 0]));

  for (const job of jobs) {
    if (job?.source in counts) {
      counts[job.source] += 1;
    }
  }

  return counts;
}

function validateCatalog(jobs) {
  if (jobs.length === 0) {
    throw new Error("Catálogo vazio. Sincronização cancelada.");
  }

  const sourceCounts = countSources(jobs);
  const missing = EXPECTED_SOURCES.filter((source) => sourceCounts[source] === 0);

  if (missing.length > 0) {
    throw new Error(
      `Fontes sem nenhuma vaga no JSON: ${missing.join(", ")}. Sincronização cancelada por segurança.`,
    );
  }

  const invalid = jobs.filter(
    (job) =>
      !job?.source ||
      !job?.external_id ||
      !job?.title ||
      !job?.company ||
      !job?.application_url ||
      !job?.published_at,
  );

  if (invalid.length > 0) {
    throw new Error(
      `${invalid.length} vagas inválidas encontradas. Rode merge-jobs.mjs novamente.`,
    );
  }

  return sourceCounts;
}

function dbPayload(job, syncStartedAt) {
  return {
    source: job.source,
    external_id: job.external_id,
    title: job.title,
    company: job.company,

    category: job.category ?? "Outros",
    seniority: job.seniority ?? "nao_informado",

    workplace_type: job.workplace_type ?? "unknown",
    source_workplace_type: job.source_workplace_type ?? null,

    contract_type: job.contract_type ?? "nao_informado",
    source_contract_type: job.source_contract_type ?? null,

    location_text: job.location_text ?? "Local não informado",
    city: job.city ?? null,
    state: job.state ?? null,
    country: job.country ?? null,

    salary_min: job.salary_min ?? null,
    salary_max: job.salary_max ?? null,
    salary_currency: job.salary_currency ?? null,
    salary_interval: job.salary_interval ?? null,
    salary_description: job.salary_description ?? null,

    application_url: job.application_url,

    description:
      "Consulte a descrição completa, os requisitos e as condições na página oficial da vaga.",

    skills: Array.isArray(job.skills) ? job.skills : [],

    published_at: job.published_at,
    published_at_source: job.published_at_source ?? null,
    application_deadline: job.application_deadline ?? null,

    // first_seen_at é omitido de propósito:
    // INSERT -> default now()
    // UPDATE -> preserva a primeira vez em que vimos a vaga.
    last_seen_at: syncStartedAt,
    active: true,
  };
}

function chunks(array, size) {
  const result = [];

  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }

  return result;
}

async function saveSyncStatus(
  supabase,
  { syncStartedAt, syncFinishedAt, activeCount, catalogCount, sourceCounts, durationMs },
) {
  const statusPayload = {
    id: STATUS_ROW_ID,
    status: "success",
    last_successful_sync: syncFinishedAt,
    sync_started_at: syncStartedAt,
    total_jobs: activeCount,
    catalog_jobs: catalogCount,
    source_counts: sourceCounts,
    duration_ms: durationMs,
    updated_at: syncFinishedAt,
  };

  const { error } = await supabase.from(STATUS_TABLE).upsert(statusPayload, {
    onConflict: "id",
    ignoreDuplicates: false,
  });

  if (error) {
    throw new Error(
      `Vagas sincronizadas, mas falhou ao registrar status em ${STATUS_TABLE}: ${error.message}`,
    );
  }
}

async function main() {
  await loadProjectEnv();

  const apply = process.argv.includes("--apply");
  const jobs = await readJobs();
  const sourceCounts = validateCatalog(jobs);

  console.log("====================================");
  console.log("Radar Vagas - Sync Supabase");
  console.log("====================================");
  console.log(`Arquivo: ${INPUT_FILE}`);
  console.log(`Vagas: ${jobs.length}`);
  console.table(sourceCounts);

  if (!apply) {
    console.log("");
    console.log("DRY RUN.");
    console.log("Nenhuma alteração foi feita no Supabase.");
    console.log("");
    console.log("Para gravar:");
    console.log("node .\\scripts\\sync-supabase.mjs --apply");
    return;
  }

  const { url, secret } = requiredConfig();

  const supabase = createClient(url, secret, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const syncStartedAt = new Date().toISOString();
  const syncStartedMs = Date.now();

  const payload = jobs.map((job) => dbPayload(job, syncStartedAt));
  const batches = chunks(payload, BATCH_SIZE);

  console.log("");
  console.log(`Sincronização iniciada: ${syncStartedAt}`);
  console.log(`Lotes: ${batches.length} de até ${BATCH_SIZE}`);

  let processed = 0;

  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index];

    const { error } = await supabase.from("jobs").upsert(batch, {
      onConflict: "source,external_id",
      ignoreDuplicates: false,
    });

    if (error) {
      throw new Error(`Falha no lote ${index + 1}/${batches.length}: ${error.message}`);
    }

    processed += batch.length;

    console.log(`Lote ${index + 1}/${batches.length} OK | ${processed}/${payload.length}`);
  }

  // Após TODOS os upserts concluírem, vagas que já estavam no banco
  // mas não apareceram nesta execução deixam de ser públicas.
  const { error: inactiveError } = await supabase
    .from("jobs")
    .update({ active: false })
    .eq("active", true)
    .lt("last_seen_at", syncStartedAt);

  if (inactiveError) {
    throw new Error(
      `Upsert concluído, mas falhou ao marcar vagas ausentes: ${inactiveError.message}`,
    );
  }

  // Retenção física: remove registros publicados antes da janela.
  const cutoff = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { error: retentionError } = await supabase.from("jobs").delete().lt("published_at", cutoff);

  if (retentionError) {
    throw new Error(`Falha na retenção de ${WINDOW_DAYS} dias: ${retentionError.message}`);
  }

  const { count: activeCount, error: countError } = await supabase
    .from("jobs")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("active", true);

  if (countError) {
    throw new Error(`Carga concluída, mas falhou ao contar vagas: ${countError.message}`);
  }

  const syncFinishedAt = new Date().toISOString();
  const durationMs = Date.now() - syncStartedMs;

  // Só registra a atualização depois que todo o sync terminou com sucesso.
  await saveSyncStatus(supabase, {
    syncStartedAt,
    syncFinishedAt,
    activeCount: activeCount ?? jobs.length,
    catalogCount: jobs.length,
    sourceCounts,
    durationMs,
  });

  console.log("");
  console.log("====================================");
  console.log("SYNC CONCLUÍDO");
  console.log("====================================");
  console.log(`Upserts processados: ${processed}`);
  console.log(`Vagas ativas no Supabase: ${activeCount ?? "não informado"}`);
  console.log(`Retenção: ${WINDOW_DAYS} dias`);
  console.log(`Última atualização registrada: ${syncFinishedAt}`);
  console.log(`Duração do sync: ${(durationMs / 1000).toFixed(1)}s`);
  console.log("====================================");
}

main().catch((error) => {
  console.error("Falha fatal no sync:", error instanceof Error ? error.message : error);

  process.exitCode = 1;
});
