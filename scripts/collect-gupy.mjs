const BASE_URL = "https://employability-portal.gupy.io/api/v1/jobs";

const QUERIES = ["Analista de Dados", "Data Analyst", "Analista de BI", "Business Intelligence"];

const PAGE_SIZE = 100;

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

  const upper = String(state).trim().toUpperCase();

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
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeSkills(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
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
}

function mapGupyJob(job) {
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

    active: true,
  };
}

async function fetchJobs(query, offset = 0) {
  const url = new URL(BASE_URL);

  url.searchParams.set("jobName", query);
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("limit", String(PAGE_SIZE));

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Radar-Vagas/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Gupy respondeu ${response.status} ${response.statusText}`);
  }

  return response.json();
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

    await new Promise((resolve) => setTimeout(resolve, 300));
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

async function main() {
  console.log("====================================");
  console.log("Radar Vagas - Gupy Dry Run");
  console.log("NENHUM dado será gravado no Supabase");
  console.log("====================================");

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

  const mappedJobs = rawJobs.map(mapGupyJob);

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

  const workplaceSummary = {};
  const senioritySummary = {};
  const categorySummary = {};
  const contractSummary = {};

  for (const job of validJobs) {
    workplaceSummary[job.workplace_type] = (workplaceSummary[job.workplace_type] ?? 0) + 1;

    senioritySummary[job.seniority] = (senioritySummary[job.seniority] ?? 0) + 1;

    categorySummary[job.category] = (categorySummary[job.category] ?? 0) + 1;

    contractSummary[job.contract_type] = (contractSummary[job.contract_type] ?? 0) + 1;
  }

  console.log("\n====================================");
  console.log("RESUMO");
  console.log("====================================");

  console.log(`Vagas únicas encontradas: ${rawJobs.length}`);

  console.log(`Vagas válidas: ${validJobs.length}`);

  console.log(`Vagas inválidas: ${invalidJobs.length}`);

  console.log("\nModalidade:");
  console.table(workplaceSummary);

  console.log("\nSenioridade:");
  console.table(senioritySummary);

  console.log("\nCategoria:");
  console.table(categorySummary);

  console.log("\nContrato:");
  console.table(contractSummary);

  if (invalidJobs.length > 0) {
    console.log("\nVagas inválidas:");

    console.table(invalidJobs.slice(0, 20));
  }

  console.log("\n====================================");
  console.log("AMOSTRA QUE IRIA PARA O SUPABASE");
  console.log("====================================\n");

  console.dir(validJobs.slice(0, 5), {
    depth: null,
    colors: true,
  });

  console.log("\n====================================");
  console.log("DRY RUN FINALIZADO");
  console.log("Nenhum dado foi gravado.");
  console.log("====================================");
}

main().catch((error) => {
  console.error("Falha fatal no coletor:", error);

  process.exitCode = 1;
});
