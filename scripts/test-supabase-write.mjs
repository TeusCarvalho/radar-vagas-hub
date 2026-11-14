import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const GUPY_URL =
  "https://employability-portal.gupy.io/api/v1/jobs";

const STATE_TO_UF = {
  Acre: "AC",
  Alagoas: "AL",
  Amapá: "AP",
  Amazonas: "AM",
  Bahia: "BA",
  Ceará: "CE",
  "Distrito Federal": "DF",
  "Espírito Santo": "ES",
  Goiás: "GO",
  Maranhão: "MA",
  "Mato Grosso": "MT",
  "Mato Grosso do Sul": "MS",
  "Minas Gerais": "MG",
  Pará: "PA",
  Paraíba: "PB",
  Paraná: "PR",
  Pernambuco: "PE",
  Piauí: "PI",
  "Rio de Janeiro": "RJ",
  "Rio Grande do Norte": "RN",
  "Rio Grande do Sul": "RS",
  Rondônia: "RO",
  Roraima: "RR",
  "Santa Catarina": "SC",
  "São Paulo": "SP",
  Sergipe: "SE",
  Tocantins: "TO",
};

function loadLocalEnv(filePath) {
  const content = readFileSync(filePath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line
      .slice(0, separatorIndex)
      .trim();

    let value = line
      .slice(separatorIndex + 1)
      .trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
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

  if (STATE_TO_UF[state]) {
    return STATE_TO_UF[state];
  }

  const upper = String(state)
    .trim()
    .toUpperCase();

  if (/^[A-Z]{2}$/.test(upper)) {
    return upper;
  }

  return null;
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

  if (
    /\bestagio\b/.test(text) ||
    /\bestagiario\b/.test(text) ||
    /\binternship\b/.test(text)
  ) {
    return "estagio";
  }

  if (
    /\bjunior\b/.test(text) ||
    /\bjr\b/.test(text)
  ) {
    return "junior";
  }

  if (
    /\bpleno\b/.test(text) ||
    /\bpl\b/.test(text)
  ) {
    return "pleno";
  }

  if (
    /\bsenior\b/.test(text) ||
    /\bsr\b/.test(text)
  ) {
    return "senior";
  }

  if (
    /\bespecialista\b/.test(text) ||
    /\bspecialist\b/.test(text)
  ) {
    return "especialista";
  }

  return "nao_informado";
}

function inferCategory(title) {
  const text = normalizeText(title);

  if (
    text.includes("business intelligence") ||
    /\bbi\b/.test(text)
  ) {
    return "Business Intelligence";
  }

  if (
    text.includes("business analyst") ||
    text.includes("analista de negocios") ||
    text.includes("inteligencia de negocios")
  ) {
    return "Negócios";
  }

  if (
    text.includes("growth") ||
    text.includes("revenue operations") ||
    /\brevops\b/.test(text)
  ) {
    return "Growth";
  }

  return "Dados e Analytics";
}

function normalizeContractType(
  type,
  description = "",
) {
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
    /\bcontrato clt\b/.test(text)
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

function cleanDescription(value) {
  if (!value) {
    return null;
  }

  return String(value)
    .replace(/&nbsp;/gi, " ")
    .replace(/&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
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

  if (
    job.workplaceType === "remote" ||
    job.isRemoteWork === true
  ) {
    return "Remoto - Brasil";
  }

  return job.country || "Local não informado";
}

function mapJob(job) {
  const state = normalizeState(job.state);

  return {
    source: "gupy",
    external_id: String(job.id),
    title: String(job.name ?? "").trim(),
    company: String(
      job.careerPageName ??
        "Empresa não informada",
    ).trim(),
    category: inferCategory(job.name),
    seniority: inferSeniority(job.name),
    workplace_type:
      normalizeWorkplaceType(
        job.workplaceType,
      ),
    contract_type:
      normalizeContractType(
        job.type,
        job.description,
      ),
    location_text:
      makeLocationText(job, state),
    city: job.city
      ? String(job.city).trim()
      : null,
    state,
    country:
      job.country || "Brasil",
    application_url:
      String(job.jobUrl ?? "").trim(),
    description:
      cleanDescription(job.description),
    application_deadline:
      job.applicationDeadline || null,
    skills: Array.isArray(job.skills)
      ? job.skills
      : [],
    published_at:
      job.publishedDate || null,
    last_seen_at:
      new Date().toISOString(),
    active: true,
  };
}

async function getOneRealJob() {
  const url = new URL(GUPY_URL);

  url.searchParams.set(
    "jobName",
    "Analista de Dados",
  );

  url.searchParams.set("offset", "0");
  url.searchParams.set("limit", "1");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Radar-Vagas/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Gupy respondeu ${response.status}`,
    );
  }

  const body = await response.json();

  const jobs = Array.isArray(body?.data)
    ? body.data
    : Array.isArray(body?.results)
      ? body.results
      : [];

  if (jobs.length === 0) {
    throw new Error(
      "Nenhuma vaga encontrada na Gupy.",
    );
  }

  return jobs[0];
}

async function main() {
  if (!process.argv.includes("--apply")) {
    console.error(
      "Teste de escrita LEGADO bloqueado por padrão. " +
      "Executar com --apply somente após autorização e backup validado.",
    );
    process.exitCode = 1;
    return;
  }
  console.log(
    "====================================",
  );
  console.log(
    "Radar Vagas - Teste de escrita",
  );
  console.log(
    "SOMENTE 1 VAGA SERÁ GRAVADA",
  );
  console.log(
    "====================================",
  );

  loadLocalEnv(
    ".env.collector.local",
  );

  const url =
    process.env.SUPABASE_URL;

  const secretKey =
    process.env.SUPABASE_SECRET_KEY;

  if (!url) {
    throw new Error(
      "SUPABASE_URL não configurada.",
    );
  }

  if (
    !secretKey?.startsWith(
      "sb_secret_",
    )
  ) {
    throw new Error(
      "SUPABASE_SECRET_KEY inválida.",
    );
  }

  const supabase = createClient(
    url,
    secretKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  console.log(
    "\nBuscando uma vaga real na Gupy...",
  );

  const rawJob =
    await getOneRealJob();

  const job =
    mapJob(rawJob);

  console.log("\nVaga selecionada:");
  console.log(
    `${job.company} — ${job.title}`,
  );

  console.log(
    `ID Gupy: ${job.external_id}`,
  );

  console.log(
    "\nGravando somente essa vaga...",
  );

  const {
    data,
    error,
  } = await supabase
    .from("jobs")
    .upsert(job, {
      onConflict:
        "source,external_id",
    })
    .select(
      "id,source,external_id,title,company,workplace_type,active",
    )
    .single();

  if (error) {
    throw new Error(
      `Falha no upsert: ${error.message}`,
    );
  }

  console.log(
    "\n✅ Vaga gravada com sucesso.",
  );

  console.table([
    {
      id: data.id,
      fonte: data.source,
      external_id:
        data.external_id,
      titulo: data.title,
      empresa: data.company,
      modalidade:
        data.workplace_type,
      ativa: data.active,
    },
  ]);

  console.log(
    "\nIMPORTANTE:",
  );

  console.log(
    "Somente 1 vaga foi gravada.",
  );

  console.log(
    "Nenhuma exclusão foi realizada.",
  );
}

main().catch((error) => {
  console.error(
    "\n❌ ERRO:",
    error instanceof Error
      ? error.message
      : error,
  );

  process.exitCode = 1;
});