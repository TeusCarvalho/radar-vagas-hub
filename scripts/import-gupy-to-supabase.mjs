import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

const BASE_URL = "https://employability-portal.gupy.io/api/v1/jobs";

const QUERIES = ["Analista de Dados", "Data Analyst", "Analista de BI", "Business Intelligence"];

const PAGE_SIZE = 100;
const UPSERT_BATCH_SIZE = 100;

const STATE_TO_UF = {
  acre: "AC",
  alagoas: "AL",
  amapa: "AP",
  amazonas: "AM",
  bahia: "BA",
  ceara: "CE",
  "distrito federal": "DF",
  "espirito santo": "ES",
  goias: "GO",
  maranhao: "MA",
  "mato grosso": "MT",
  "mato grosso do sul": "MS",
  "minas gerais": "MG",
  para: "PA",
  paraiba: "PB",
  parana: "PR",
  pernambuco: "PE",
  piaui: "PI",
  "rio de janeiro": "RJ",
  "rio grande do norte": "RN",
  "rio grande do sul": "RS",
  rondonia: "RO",
  roraima: "RR",
  "santa catarina": "SC",
  "sao paulo": "SP",
  sergipe: "SE",
  tocantins: "TO",
};

function loadEnvFile(filename) {
  const filepath = resolve(process.cwd(), filename);

  if (!existsSync(filepath)) {
    throw new Error(`Arquivo ${filename} não encontrado.`);
  }

  const content = readFileSync(filepath, "utf8").replace(/^\uFEFF/, "");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separator = line.indexOf("=");

    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function requireEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Variável ${name} não encontrada.`);
  }

  return value;
}

function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizeState(state) {
  if (!state) {
    return null;
  }

  const raw = String(state).trim();

  const upper = raw.toUpperCase();

  if (/^[A-Z]{2}$/.test(upper)) {
    return upper;
  }

  return STATE_TO_UF[normalizeText(raw)] ?? null;
}

function normalizeWorkplaceType(value) {
  switch (value) {
    case "remote":
      return "remote";

    case "hybrid":
      return "hybrid";

    case "on-site":
    case "onsite":
      return "onsite";

    default:
      return "unknown";
  }
}

function inferSeniority(title) {
  const text = normalizeText(title);

  if (/\bestagio\b/.test(text) || /\bestagiario\b/.test(text) || /\binternship\b/.test(text)) {
    return "estagio";
  }

  if (/\bjunior\b/.test(text) || /\bjr\b/.test(text)) {
    return "junior";
  }

  if (/\bpleno\b/.test(text) || /\bpl\b/.test(text)) {
    return "pleno";
  }

  if (/\bsenior\b/.test(text) || /\bsr\b/.test(text)) {
    return "senior";
  }

  if (/\bespecialista\b/.test(text) || /\bspecialist\b/.test(text)) {
    return "especialista";
  }

  return "nao_informado";
}

function inferCategory(title) {
  const text = normalizeText(title);

  if (text.includes("business intelligence") || /\bbi\b/.test(text)) {
    return "Business Intelligence";
  }

  if (
    text.includes("business analyst") ||
    text.includes("analista de negocios") ||
    text.includes("inteligencia de negocios")
  ) {
    return "Negócios";
  }

  if (text.includes("growth") || text.includes("revenue operations") || /\brevops\b/.test(text)) {
    return "Growth";
  }

  if (
    text.includes("dados") ||
    text.includes("data analyst") ||
    text.includes("analytics") ||
    text.includes("data analytics")
  ) {
    return "Dados e Analytics";
  }

  return "Dados e Analytics";
}

function normalizeContractType(type, description = "") {
  const text = normalizeText(description);

  if (type === "vacancy_type_internship") {
    return "estagio";
  }

  if (type === "vacancy_type_temporary") {
    return "temporario";
  }

  if (
    /\bcontratacao clt\b/.test(text) ||
    /\bregime clt\b/.test(text) ||
    /\bcontrato clt\b/.test(text) ||
    /\bcontratado clt\b/.test(text)
  ) {
    return "clt";
  }

  if (
    /\bcontratacao pj\b/.test(text) ||
    /\bregime pj\b/.test(text) ||
    /\bcontrato pj\b/.test(text) ||
    /\bpessoa juridica\b/.test(text)
  ) {
    return "pj";
  }

  return "nao_informado";
}

function makeLocationText(job, state) {
  const city = String(job.city ?? "").trim();

  if (city && state) {
    return `${city}, ${state}`;
  }

  if (city) {
    return city;
  }

  if (state) {
    return state;
  }

  if (job.workplaceType === "remote" || job.isRemoteWork === true) {
    return "Remoto - Brasil";
  }

  if (job.country) {
    return String(job.country).trim();
  }

  return "Local não informado";
}

function cleanDescription(value) {
  if (!value) {
    return null;
  }

  return String(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<\/li>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(
      /(Responsabilidades e atribuições|Requisitos e qualificações|Informações adicionais)/gi,
      "\n\n$1\n",
    )
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeSkills(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const skills = value
    .map((skill) => {
      if (typeof skill === "string") {
        return skill.trim();
      }

      if (skill && typeof skill === "object") {
        return String(skill.name ?? skill.label ?? skill.title ?? "").trim();
      }

      return "";
    })
    .filter(Boolean);

  return [...new Set(skills)];
}

function mapGupyJob(job, runTimestamp) {
  const state = normalizeState(job.state);

  const workplaceType = normalizeWorkplaceType(job.workplaceType);

  return {
    source: "gupy",

    external_id: String(job.id),

    title: String(job.name ?? "").trim(),

    company: String(job.careerPageName ?? "Empresa não informada").trim(),

    category: inferCategory(job.name),

    seniority: inferSeniority(job.name),

    workplace_type: workplaceType,

    contract_type: normalizeContractType(job.type, job.description),

    location_text: makeLocationText(job, state),

    city: job.city ? String(job.city).trim() : null,

    state,

    country: job.country ? String(job.country).trim() : "Brasil",

    application_url: String(job.jobUrl ?? "").trim(),

    description: cleanDescription(job.description),

    application_deadline: job.applicationDeadline || null,

    skills: normalizeSkills(job.skills),

    published_at: job.publishedDate || null,

    last_seen_at: runTimestamp,

    updated_at: runTimestamp,

    active: true,
  };
}

async function fetchJobs(query, offset = 0) {
  const url = new URL(BASE_URL);

  url.searchParams.set("jobName", query);

  url.searchParams.set("offset", String(offset));

  url.searchParams.set("limit", String(PAGE_SIZE));

  let lastError;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",

          "User-Agent": "Radar-Vagas/1.0",
        },
      });

      if (!response.ok) {
        throw new Error(`Gupy respondeu ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      lastError = error;

      if (attempt < 3) {
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 1000 * attempt));
      }
    }
  }

  throw lastError;
}

async function collectQuery(query) {
  console.log(`\nBuscando: "${query}"`);

  const collected = [];

  let offset = 0;

  while (true) {
    const data = await fetchJobs(query, offset);

    const jobs = Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.results)
        ? data.results
        : [];

    console.log(`  offset=${offset} -> ${jobs.length} vagas`);

    collected.push(...jobs);

    if (jobs.length < PAGE_SIZE) {
      break;
    }

    offset += PAGE_SIZE;

    await new Promise((resolvePromise) => setTimeout(resolvePromise, 300));
  }

  return collected;
}

function validateJob(job) {
  const errors = [];

  if (!job.external_id) {
    errors.push("external_id");
  }

  if (!job.title) {
    errors.push("title");
  }

  if (!job.company) {
    errors.push("company");
  }

  if (!job.application_url) {
    errors.push("application_url");
  }

  return errors;
}

function splitIntoBatches(items, size) {
  const batches = [];

  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }

  return batches;
}

async function getExistingGupyIds(supabase) {
  const { data, error } = await supabase
    .from("jobs")
    .select("external_id")
    .eq("source", "gupy")
    .limit(1000);

  if (error) {
    throw new Error(`Falha ao consultar vagas existentes: ${error.message}`);
  }

  return new Set((data ?? []).map((row) => String(row.external_id)));
}

async function getActiveGupyCount(supabase) {
  const { count, error } = await supabase
    .from("jobs")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("source", "gupy")
    .eq("active", true);

  if (error) {
    throw new Error(`Falha ao contar vagas: ${error.message}`);
  }

  return count ?? 0;
}

async function main() {
  if (!process.argv.includes("--apply")) {
    console.error(
      "Importação LEGADA bloqueada por padrão. " +
      "Usar o pipeline oficial scripts/merge-jobs.mjs + scripts/sync-supabase.mjs. " +
      "Se houver aprovação expressa para a rota antiga, executar com --apply e backup validado.",
    );
    process.exitCode = 1;
    return;
  }
  console.log("====================================");

  console.log("Radar Vagas - Importação Gupy");

  console.log("====================================");

  loadEnvFile(".env.collector.local");

  const SUPABASE_URL = requireEnv("SUPABASE_URL");

  const SUPABASE_SECRET_KEY = requireEnv("SUPABASE_SECRET_KEY");

  try {
    new URL(SUPABASE_URL);
  } catch {
    throw new Error("SUPABASE_URL inválida.");
  }

  console.log("Supabase configurado.");

  console.log("A chave secreta não será exibida.");

  const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: {
      persistSession: false,

      autoRefreshToken: false,

      detectSessionInUrl: false,
    },
  });

  console.log("\nConsultando vagas que já existem...");

  const existingIds = await getExistingGupyIds(supabase);

  console.log(`${existingIds.size} vaga(s) da Gupy já existem no banco.`);

  const rawJobsById = new Map();

  for (const query of QUERIES) {
    try {
      const jobs = await collectQuery(query);

      for (const job of jobs) {
        if (!job?.id) {
          continue;
        }

        rawJobsById.set(String(job.id), job);
      }
    } catch (error) {
      console.error(`Erro ao buscar "${query}":`, error instanceof Error ? error.message : error);
    }
  }

  const rawJobs = [...rawJobsById.values()];

  const runTimestamp = new Date().toISOString();

  const mappedJobs = rawJobs.map((job) => mapGupyJob(job, runTimestamp));

  const validJobs = [];
  const invalidJobs = [];

  for (const job of mappedJobs) {
    const errors = validateJob(job);

    if (errors.length > 0) {
      invalidJobs.push({
        external_id: job.external_id,

        title: job.title,

        errors,
      });
    } else {
      validJobs.push(job);
    }
  }

  console.log("\n====================================");

  console.log("COLETA FINALIZADA");

  console.log("====================================");

  console.log(`Vagas únicas: ${rawJobs.length}`);

  console.log(`Vagas válidas: ${validJobs.length}`);

  console.log(`Vagas inválidas: ${invalidJobs.length}`);

  if (validJobs.length === 0) {
    throw new Error("Nenhuma vaga válida encontrada. Importação cancelada.");
  }

  const newJobs = validJobs.filter((job) => !existingIds.has(job.external_id)).length;

  const existingJobs = validJobs.length - newJobs;

  console.log(`Novas: ${newJobs}`);

  console.log(`Já existentes/atualizadas: ${existingJobs}`);

  if (invalidJobs.length > 0) {
    console.log("\nPrimeiras vagas inválidas:");

    console.table(invalidJobs.slice(0, 10));
  }

  console.log("\nIniciando gravação no Supabase...");

  const batches = splitIntoBatches(validJobs, UPSERT_BATCH_SIZE);

  let processed = 0;

  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index];

    console.log(`Lote ${index + 1}/${batches.length}: ${batch.length} vagas`);

    const { error } = await supabase.from("jobs").upsert(batch, {
      onConflict: "source,external_id",
    });

    if (error) {
      throw new Error(`Falha no lote ${index + 1}: ${error.message}`);
    }

    processed += batch.length;

    console.log(`  OK - ${processed}/${validJobs.length}`);
  }

  const activeCount = await getActiveGupyCount(supabase);

  console.log("\n====================================");

  console.log("IMPORTAÇÃO CONCLUÍDA");

  console.log("====================================");

  console.log(`Processadas: ${processed}`);

  console.log(`Novas estimadas: ${newJobs}`);

  console.log(`Atualizadas estimadas: ${existingJobs}`);

  console.log(`Gupy ativas no banco: ${activeCount}`);

  console.log("\nNenhuma vaga foi apagada ou desativada.");

  console.log("====================================");
}

main().catch((error) => {
  console.error("\nFalha fatal:", error instanceof Error ? error.message : error);

  process.exitCode = 1;
});
