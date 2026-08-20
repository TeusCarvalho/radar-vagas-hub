import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUTS = [
  ["gupy", path.join(__dirname, "gupy-results.json")],
  ["inhire", path.join(__dirname, "inhire-results.json")],
  ["greenhouse", path.join(__dirname, "greenhouse-results.json")],
  ["lever", path.join(__dirname, "lever-results.json")],
  ["ashby", path.join(__dirname, "ashby-results.json")],
  ["infojobs", path.join(__dirname, "infojobs-results.json")],
];

const OUTPUT_FILE = path.join(__dirname, "radar-jobs.json");
const REPORT_FILE = path.join(__dirname, "radar-jobs-report.json");

const SOURCE_PRIORITY = {
  gupy: 5,
  inhire: 4,
  greenhouse: 3,
  ashby: 2,
  lever: 1,
  infojobs: 1,
};

function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " e ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCompany(value = "") {
  return normalizeText(value)
    .replace(/\b(sa|s a|ltda|lt|inc|llc|corp|corporation|company|co)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTitle(value = "") {
  return normalizeText(value)
    .replace(/\b(vaga|oportunidade)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeState(value) {
  const state = String(value ?? "")
    .trim()
    .toUpperCase();
  return /^[A-Z]{2}$/.test(state) ? state : "";
}

function normalizeCity(value) {
  return normalizeText(value ?? "");
}

function locationKey(job) {
  const state = normalizeState(job.state);
  const city = normalizeCity(job.city);

  if (city && state) return `${city}:${state}`;
  if (state) return state;

  const location = normalizeText(job.location_text ?? "");

  if (job.workplace_type === "remote" || /\bremote\b|\bremoto\b|\bhome office\b/.test(location)) {
    return "remote";
  }

  return location || "unknown";
}

function isGenericCompany(value = "") {
  const company = normalizeCompany(value);

  return (
    !company ||
    company === "empresa nao informada" ||
    company === "empresa confidencial" ||
    company === "confidencial" ||
    company === "nao informado"
  );
}

function isUnknownLocationKey(value = "") {
  const location = normalizeText(value);

  return (
    !location ||
    location === "unknown" ||
    location === "local nao informado" ||
    location === "nao informado"
  );
}

function companyTitleKey(job) {
  const company = normalizeCompany(job.company);
  const title = normalizeTitle(job.title);

  if (isGenericCompany(job.company) || !title) {
    return null;
  }

  return `${company}|${title}`;
}

function canonicalKey(job) {
  return [normalizeCompany(job.company), normalizeTitle(job.title), locationKey(job)].join("|");
}

function validUrl(value) {
  try {
    const url = new URL(String(value ?? ""));
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function completenessScore(job) {
  let score = SOURCE_PRIORITY[job.source] ?? 0;

  const valuable = [
    job.title,
    job.company,
    job.city,
    job.state,
    job.country,
    job.location_text,
    job.category,
    job.seniority !== "nao_informado" ? job.seniority : null,
    job.workplace_type !== "unknown" ? job.workplace_type : null,
    job.contract_type !== "nao_informado" ? job.contract_type : null,
    job.salary_min,
    job.salary_max,
    job.salary_currency,
    job.salary_description,
    job.application_deadline,
  ];

  score += valuable.filter((value) => value !== null && value !== undefined && value !== "").length;

  if (Array.isArray(job.skills)) {
    score += Math.min(job.skills.length, 10) * 0.2;
  }

  return score;
}

function chooseBest(a, b) {
  return completenessScore(b) > completenessScore(a) ? b : a;
}

function sanitizeForPublic(job, nowIso) {
  return {
    source: String(job.source ?? "").trim(),
    external_id: String(job.external_id ?? "").trim(),
    title: String(job.title ?? "").trim(),
    company: String(job.company ?? "").trim(),
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
    application_url: String(job.application_url ?? "").trim(),

    // Não republicamos a descrição integral da fonte.
    description:
      "Consulte a descrição completa, os requisitos e as condições na página oficial da vaga.",

    skills: Array.isArray(job.skills)
      ? [
          ...new Set(
            job.skills
              .map(String)
              .map((x) => x.trim())
              .filter(Boolean),
          ),
        ]
      : [],

    published_at: job.published_at ?? null,
    published_at_source: job.published_at_source ?? null,
    application_deadline: job.application_deadline ?? null,
    first_seen_at: job.first_seen_at ?? nowIso,
    last_seen_at: nowIso,
    active: job.active !== false,
  };
}

function validate(job) {
  const errors = [];

  if (!job.source) errors.push("source");
  if (!job.external_id) errors.push("external_id");
  if (!job.title) errors.push("title");
  if (!job.company) errors.push("company");
  if (!validUrl(job.application_url)) errors.push("application_url");
  if (!job.published_at) errors.push("published_at");

  return errors;
}

async function readJson(file) {
  const raw = await fs.readFile(file, "utf8");
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error(`${file} não contém um array JSON.`);
  }

  return parsed;
}

async function main() {
  const nowIso = new Date().toISOString();

  console.log("====================================");
  console.log("Radar Vagas - Merge + Deduplicação");
  console.log("====================================");

  const all = [];
  const sourceCounts = {};
  const missingFiles = [];

  for (const [source, file] of INPUTS) {
    try {
      const jobs = await readJson(file);
      sourceCounts[source] = jobs.length;

      for (const job of jobs) {
        all.push(job);
      }

      console.log(`${source.padEnd(12)} ${String(jobs.length).padStart(6)} vagas`);
    } catch (error) {
      if (error?.code === "ENOENT") {
        missingFiles.push(file);
        sourceCounts[source] = 0;
        console.warn(`${source.padEnd(12)} arquivo não encontrado`);
        continue;
      }

      throw error;
    }
  }

  console.log("------------------------------------");
  console.log(`Total bruto: ${all.length}`);

  // 1) Deduplicação absoluta dentro da própria fonte.
  const bySourceExternalId = new Map();

  for (const job of all) {
    const source = String(job.source ?? "").trim();
    const externalId = String(job.external_id ?? "").trim();

    if (!source || !externalId) continue;

    const key = `${source}|${externalId}`;
    const existing = bySourceExternalId.get(key);

    bySourceExternalId.set(key, existing ? chooseBest(existing, job) : job);
  }

  const afterInternal = [...bySourceExternalId.values()];
  const internalDuplicates = all.length - afterInternal.length;

  // 2) Deduplicação conservadora entre plataformas.
  //
  // Regra A:
  // empresa + título + localização normalizados precisam coincidir.
  //
  // Regra B (fallback seguro):
  // mesma empresa + mesmo título e apenas UMA localização concreta
  // conhecida no grupo. Isso cobre casos em que uma fonte (ex.: InfoJobs)
  // informa "Local não informado", sem deduplicar vagas homônimas de
  // empresas diferentes ou vagas da mesma empresa em várias cidades.
  //
  // Nunca usamos apenas título ou título+localização sem empresa.

  const byCanonical = new Map();
  const duplicateGroups = [];

  for (const job of afterInternal) {
    const key = canonicalKey(job);
    const [company, title, location] = key.split("|");

    // Empresa genérica/confidencial ou chave incompleta:
    // não fazemos dedupe cross-source.
    if (isGenericCompany(job.company) || !company || !title || isUnknownLocationKey(location)) {
      byCanonical.set(`${job.source}|${job.external_id}`, job);
      continue;
    }

    const existing = byCanonical.get(key);

    if (!existing) {
      byCanonical.set(key, job);
      continue;
    }

    if (existing.source === job.source) {
      // Segurança extra: dentro da mesma fonte a chave oficial é source+external_id.
      byCanonical.set(`${key}|${job.source}|${job.external_id}`, job);
      continue;
    }

    const chosen = chooseBest(existing, job);
    const discarded = chosen === existing ? job : existing;

    duplicateGroups.push({
      reason: "company_title_location",
      canonical_key: key,
      kept: {
        source: chosen.source,
        external_id: chosen.external_id,
        title: chosen.title,
        company: chosen.company,
        application_url: chosen.application_url,
      },
      discarded: {
        source: discarded.source,
        external_id: discarded.external_id,
        title: discarded.title,
        company: discarded.company,
        application_url: discarded.application_url,
      },
    });

    byCanonical.set(key, chosen);
  }

  // 3) Fallback para localização ausente em uma das fontes.
  //
  // Agrupamos por empresa+título e só deduplicamos registros sem localização
  // quando existe exatamente UMA localização concreta conhecida no grupo.
  // Se a mesma empresa/título existir em duas ou mais cidades, o registro
  // sem localização é preservado para evitar falso positivo.

  const stage2 = [...byCanonical.values()];
  const companyTitleGroups = new Map();

  for (const job of stage2) {
    const key = companyTitleKey(job);
    if (!key) continue;

    if (!companyTitleGroups.has(key)) {
      companyTitleGroups.set(key, []);
    }

    companyTitleGroups.get(key).push(job);
  }

  const fallbackDiscarded = new Set();
  const fallbackReplacement = new Map();

  for (const [key, jobs] of companyTitleGroups) {
    const sources = new Set(jobs.map((job) => job.source));
    if (sources.size < 2) continue;

    const knownLocationJobs = jobs.filter((job) => !isUnknownLocationKey(locationKey(job)));

    const unknownLocationJobs = jobs.filter((job) => isUnknownLocationKey(locationKey(job)));

    if (knownLocationJobs.length === 0 || unknownLocationJobs.length === 0) {
      continue;
    }

    const concreteLocations = new Set(knownLocationJobs.map((job) => locationKey(job)));

    // Ambíguo: mesma empresa+título existe em mais de uma localização.
    if (concreteLocations.size !== 1) {
      continue;
    }

    let representative = knownLocationJobs[0];

    for (const candidate of knownLocationJobs.slice(1)) {
      if (candidate.source === representative.source) continue;
      representative = chooseBest(representative, candidate);
    }

    for (const unknown of unknownLocationJobs) {
      if (unknown.source === representative.source) {
        continue;
      }

      const chosen = chooseBest(representative, unknown);
      const discarded = chosen === representative ? unknown : representative;

      duplicateGroups.push({
        reason: "company_title_single_known_location",
        canonical_key: `${key}|${locationKey(representative)}`,
        kept: {
          source: chosen.source,
          external_id: chosen.external_id,
          title: chosen.title,
          company: chosen.company,
          application_url: chosen.application_url,
        },
        discarded: {
          source: discarded.source,
          external_id: discarded.external_id,
          title: discarded.title,
          company: discarded.company,
          application_url: discarded.application_url,
        },
      });

      fallbackDiscarded.add(`${discarded.source}|${discarded.external_id}`);

      representative = chosen;
    }

    fallbackReplacement.set(key, representative);
  }

  const byFallback = new Map();

  for (const job of stage2) {
    const identity = `${job.source}|${job.external_id}`;

    if (fallbackDiscarded.has(identity)) {
      continue;
    }

    const key = companyTitleKey(job);
    const replacement = key ? fallbackReplacement.get(key) : null;

    if (replacement && identity !== `${replacement.source}|${replacement.external_id}`) {
      // Mantém registros conhecidos adicionais da mesma fonte/local quando
      // não foram explicitamente descartados.
      byFallback.set(identity, job);
      continue;
    }

    byFallback.set(identity, job);
  }

  const deduped = [...byFallback.values()];

  const publicJobs = [];
  const invalidJobs = [];

  for (const rawJob of deduped) {
    const job = sanitizeForPublic(rawJob, nowIso);
    const errors = validate(job);

    if (errors.length) {
      invalidJobs.push({
        source: job.source,
        external_id: job.external_id,
        title: job.title,
        errors,
      });
    } else {
      publicJobs.push(job);
    }
  }

  publicJobs.sort((a, b) => {
    const aTime = Date.parse(a.published_at ?? "") || 0;
    const bTime = Date.parse(b.published_at ?? "") || 0;
    return bTime - aTime;
  });

  const report = {
    generated_at: nowIso,
    inputs: sourceCounts,
    total_raw: all.length,
    duplicate_same_source: internalDuplicates,
    duplicate_cross_source: duplicateGroups.length,
    invalid_after_merge: invalidJobs.length,
    total_public: publicJobs.length,
    missing_files: missingFiles,
    duplicate_groups: duplicateGroups,
    invalid_jobs: invalidJobs,
  };

  await fs.writeFile(OUTPUT_FILE, JSON.stringify(publicJobs, null, 2), "utf8");

  await fs.writeFile(REPORT_FILE, JSON.stringify(report, null, 2), "utf8");

  console.log("\n====================================");
  console.log("RESUMO FINAL");
  console.log("====================================");
  console.log(`Total bruto:                  ${all.length}`);
  console.log(`Duplicadas na mesma fonte:    ${internalDuplicates}`);
  console.log(`Duplicadas entre plataformas: ${duplicateGroups.length}`);
  console.log(`Inválidas após merge:         ${invalidJobs.length}`);
  console.log(`Vagas finais:                 ${publicJobs.length}`);
  console.log("");
  console.log(`JSON final:   ${OUTPUT_FILE}`);
  console.log(`Relatório:    ${REPORT_FILE}`);

  if (missingFiles.length) {
    console.log("\nATENÇÃO: alguns arquivos de entrada não foram encontrados:");
    for (const file of missingFiles) console.log(`- ${file}`);
  }

  console.log("\nA descrição integral não é publicada no radar-jobs.json.");
}

main().catch((error) => {
  console.error("Falha fatal no merge:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
