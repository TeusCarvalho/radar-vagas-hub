import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildGupySearchUrl, extractGupyRows } from "./gupy-api.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_FILE = path.join(__dirname, "gupy-results.json");

const PAGE_SIZE = 100;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;
const PAGE_DELAY_MS = 300;
const WINDOW_DAYS = 7;

const MAX_OFFSET = 9_900;

const JOB_TYPES = [
  "vacancy_type_apprentice",
  "vacancy_type_associate",
  "vacancy_type_talent_pool",
  "vacancy_type_effective",
  "vacancy_type_internship",
  "vacancy_type_summer",
  "vacancy_type_temporary",
  "vacancy_type_outsource",
  "vacancy_type_trainee",
  "vacancy_type_volunteer",
  "vacancy_legal_entity",
  "vacancy_type_lecturer",
  "vacancy_type_freelancer",
  "vacancy_type_autonomous",
];

const WORKPLACE_TYPES = ["remote", "hybrid", "on-site"];

const BRAZIL_STATE_NAMES = [
  "Acre",
  "Alagoas",
  "Amapá",
  "Amazonas",
  "Bahia",
  "Ceará",
  "Distrito Federal",
  "Espírito Santo",
  "Goiás",
  "Maranhão",
  "Mato Grosso",
  "Mato Grosso do Sul",
  "Minas Gerais",
  "Pará",
  "Paraíba",
  "Paraná",
  "Pernambuco",
  "Piauí",
  "Rio de Janeiro",
  "Rio Grande do Norte",
  "Rio Grande do Sul",
  "Rondônia",
  "Roraima",
  "Santa Catarina",
  "São Paulo",
  "Sergipe",
  "Tocantins",
];

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

const HTML_ENTITIES = {
  nbsp: " ",
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  aacute: "á",
  Aacute: "Á",
  agrave: "à",
  Agrave: "À",
  acirc: "â",
  Acirc: "Â",
  atilde: "ã",
  Atilde: "Ã",
  eacute: "é",
  Eacute: "É",
  ecirc: "ê",
  Ecirc: "Ê",
  iacute: "í",
  Iacute: "Í",
  oacute: "ó",
  Oacute: "Ó",
  ocirc: "ô",
  Ocirc: "Ô",
  otilde: "õ",
  Otilde: "Õ",
  uacute: "ú",
  Uacute: "Ú",
  uuml: "ü",
  Uuml: "Ü",
  ccedil: "ç",
  Ccedil: "Ç",
  ndash: "–",
  mdash: "—",
  ldquo: "“",
  rdquo: "”",
  lsquo: "‘",
  rsquo: "’",
  bull: "•",
  middot: "·",
};

const SKILL_PATTERNS = [
  ["Power BI", /\bpower\s*bi\b/i],
  ["SQL", /\bsql\b/i],
  ["Python", /\bpython\b/i],
  ["Excel", /\bexcel\b/i],
  ["DAX", /\bdax\b/i],
  ["Snowflake", /\bsnowflake\b/i],
  ["BigQuery", /\bbigquery\b/i],
  ["Metabase", /\bmetabase\b/i],
  ["Tableau", /\btableau\b/i],
  ["Looker", /\blooker\b/i],
  ["Google Analytics 4", /\b(?:google analytics 4|ga4)\b/i],
  ["Jira", /\bjira\b/i],
  ["Power Automate", /\bpower\s*automate\b/i],
  ["Pentaho", /\bpentaho\b/i],
  ["ETL", /\betl\b/i],
  ["ELT", /\belt\b/i],
  ["Git", /\bgit\b/i],
  ["Pandas", /\bpandas\b/i],
  ["Polars", /\bpolars\b/i],
  ["PostgreSQL", /\bpostgres(?:ql)?\b/i],
  ["MySQL", /\bmysql\b/i],
  ["SQL Server", /\bsql\s*server\b/i],
  ["Databricks", /\bdatabricks\b/i],
  ["Airflow", /\bairflow\b/i],
  ["dbt", /\bdbt\b/i],
  ["Spark", /\b(?:apache\s+)?spark\b/i],
  ["AWS", /\baws\b/i],
  ["Azure", /\bazure\b/i],
  ["Google Cloud", /\b(?:google cloud|gcp)\b/i],
  ["Docker", /\bdocker\b/i],
  ["Kubernetes", /\bkubernetes\b/i],
  ["Java", /\bjava\b/i],
  ["JavaScript", /\bjavascript\b/i],
  ["TypeScript", /\btypescript\b/i],
  ["React", /\breact(?:\.js)?\b/i],
  ["Node.js", /\bnode(?:\.js)?\b/i],
  ["C#", /\bc#\b/i],
  ["C++", /\bc\+\+\b/i],
  ["SAP", /\bsap\b/i],
  ["Salesforce", /\bsalesforce\b/i],
  ["TOTVS", /\btotvs\b/i],
  ["Oracle", /\boracle\b/i],
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function parseDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function cutoffDate(days = WINDOW_DAYS) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function isWithinWindow(value, days = WINDOW_DAYS) {
  const date = parseDate(value);
  return date ? date >= cutoffDate(days) : false;
}

function decodeHtmlEntities(value) {
  return String(value)
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    })
    .replace(/&([a-zA-Z]+);/g, (match, name) =>
      Object.prototype.hasOwnProperty.call(HTML_ENTITIES, name) ? HTML_ENTITIES[name] : match,
    );
}

function cleanDescription(value) {
  if (!value) {
    return null;
  }

  return decodeHtmlEntities(String(value))
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(
      /(Responsabilidades e atribuições|Requisitos e qualificações|Informações adicionais)/gi,
      "\n\n$1\n",
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeState(state) {
  if (!state) {
    return null;
  }

  if (STATE_TO_UF[state]) {
    return STATE_TO_UF[state];
  }

  const normalized = normalizeText(state);

  for (const [name, uf] of Object.entries(STATE_TO_UF)) {
    if (normalizeText(name) === normalized) {
      return uf;
    }
  }

  const upper = String(state).trim().toUpperCase();

  if (/^[A-Z]{2}$/.test(upper)) {
    return upper;
  }

  return null;
}

function normalizeWorkplaceType(value, isRemoteWork = false) {
  const text = normalizeText(value);

  if (isRemoteWork === true || text === "remote" || text === "remoto") {
    return "remote";
  }

  if (text === "hybrid" || text === "hibrido") {
    return "hybrid";
  }

  if (text === "on-site" || text === "onsite" || text === "presencial") {
    return "onsite";
  }

  return "unknown";
}

function inferSeniority(title) {
  const text = normalizeText(title);

  if (
    /\bestagio\b/.test(text) ||
    /\bestagiari[oa]\b/.test(text) ||
    /\bintern(ship)?\b/.test(text) ||
    /\btrainee\b/.test(text)
  ) {
    return "estagio";
  }

  if (/\bjunior\b/.test(text) || /\bjr\b/.test(text)) {
    return "junior";
  }

  if (/\bpleno\b/.test(text) || /\bpl\b/.test(text) || /\bmid\b/.test(text)) {
    return "pleno";
  }

  if (/\bsenior\b/.test(text) || /\bsr\b/.test(text)) {
    return "senior";
  }

  if (
    /\bespecialista\b/.test(text) ||
    /\bspecialist\b/.test(text) ||
    /\blead\b/.test(text) ||
    /\bcoordenador\b/.test(text) ||
    /\bcoordinator\b/.test(text) ||
    /\bgerente\b/.test(text) ||
    /\bmanager\b/.test(text)
  ) {
    return "especialista";
  }

  return "nao_informado";
}

function inferCategory(title, description = "") {
  const text = normalizeText(`${title ?? ""} ${description ?? ""}`);

  const categories = [
    [
      "Dados e Analytics",
      [
        /\banalista de dados\b/,
        /\bdata analyst\b/,
        /\bdata analytics\b/,
        /\banalytics analyst\b/,
        /\bcientista de dados\b/,
        /\bdata scientist\b/,
        /\bengenheir[oa] de dados\b/,
        /\bdata engineer\b/,
        /\banalytics engineer\b/,
      ],
    ],
    [
      "Business Intelligence",
      [/\bbusiness intelligence\b/, /\banalista de bi\b/, /\bconsultor(?:a)? de bi\b/],
    ],
    [
      "Tecnologia",
      [
        /\bdesenvolvedor/,
        /\bdeveloper\b/,
        /\bsoftware\b/,
        /\bdevops\b/,
        /\bsre\b/,
        /\bqa\b/,
        /\bquality assurance\b/,
        /\bprogramador/,
        /\bsistemas\b/,
        /\binfraestrutura\b/,
        /\bcloud\b/,
        /\bcibersegur/,
        /\bcyber/,
        /\bseguranca da informacao\b/,
        /\bsuporte ti\b/,
      ],
    ],
    [
      "Produto",
      [
        /\bproduct manager\b/,
        /\bproduct owner\b/,
        /\bproduct analyst\b/,
        /\banalista de produto\b/,
        /\bproduto\b/,
        /\bux\b/,
        /\bui\b/,
      ],
    ],
    [
      "Comercial e Vendas",
      [
        /\bvendas?\b/,
        /\bcomercial\b/,
        /\bsales\b/,
        /\bvendedor/,
        /\baccount executive\b/,
        /\baccount manager\b/,
        /\bsdr\b/,
        /\bbdr\b/,
        /\bexecutiv[oa] de contas\b/,
      ],
    ],
    [
      "Marketing e Growth",
      [
        /\bmarketing\b/,
        /\bgrowth\b/,
        /\bperformance\b/,
        /\bseo\b/,
        /\bconteudo\b/,
        /\bcontent\b/,
        /\bmidia\b/,
        /\bsocial media\b/,
        /\brevenue operations\b/,
        /\brevops\b/,
      ],
    ],
    [
      "Financeiro e Contábil",
      [
        /\bfinanceir/,
        /\bcontabil/,
        /\bcontabilidade\b/,
        /\bfiscal\b/,
        /\btesouraria\b/,
        /\bcontroladoria\b/,
        /\baccounting\b/,
        /\bfinance\b/,
      ],
    ],
    [
      "Recursos Humanos",
      [
        /\brecursos humanos\b/,
        /\brh\b/,
        /\bhuman resources\b/,
        /\brecrutamento\b/,
        /\brecruiter\b/,
        /\btalent acquisition\b/,
        /\bpeople\b/,
        /\bdepartamento pessoal\b/,
      ],
    ],
    [
      "Logística e Operações",
      [
        /\blogistic/,
        /\boperac/,
        /\bsupply chain\b/,
        /\barmazem\b/,
        /\bestoque\b/,
        /\bfrota\b/,
        /\btransport/,
        /\bexpedicao\b/,
        /\bwarehouse\b/,
      ],
    ],
    ["Engenharia", [/\bengenheir/, /\bengineering\b/, /\bengenharia\b/, /\bprojetista\b/]],
    [
      "Saúde",
      [
        /\benferm/,
        /\bmedic[oa]\b/,
        /\bfarmac/,
        /\bfisioter/,
        /\bpsicolog/,
        /\bnutri/,
        /\bsaude\b/,
        /\bhealth\b/,
      ],
    ],
    [
      "Administrativo",
      [
        /\badministrativ/,
        /\badministracao\b/,
        /\brecepcionista\b/,
        /\bsecretari/,
        /\bassistente administrativo\b/,
        /\bauxiliar administrativo\b/,
      ],
    ],
    [
      "Atendimento e Suporte",
      [
        /\batendimento\b/,
        /\bcustomer success\b/,
        /\bcustomer experience\b/,
        /\bcustomer service\b/,
        /\bsac\b/,
        /\bcall center\b/,
        /\bsuporte ao cliente\b/,
      ],
    ],
    ["Jurídico", [/\bjuridic/, /\badvogad/, /\blegal\b/, /\bcompliance\b/, /\bparalegal\b/]],
    [
      "Compras e Suprimentos",
      [/\bcompras\b/, /\bcomprador/, /\bprocurement\b/, /\bsuprimentos\b/, /\bsourcing\b/],
    ],
    ["Educação", [/\bprofessor/, /\bpedagog/, /\beducacao\b/, /\binstrutor/, /\bteacher\b/]],
    [
      "Negócios e Estratégia",
      [
        /\bbusiness analyst\b/,
        /\banalista de negocios\b/,
        /\binteligencia de negocios\b/,
        /\bestrategia\b/,
        /\bstrategy\b/,
        /\bplanejamento\b/,
      ],
    ],
    ["Design", [/\bdesigner\b/, /\bdesign\b/, /\bgrafico\b/, /\bcreative\b/]],
  ];

  for (const [category, patterns] of categories) {
    if (patterns.some((pattern) => pattern.test(text))) {
      return category;
    }
  }

  return "Outros";
}

function normalizeContractType(type, description = "") {
  const rawType = normalizeText(type);
  const text = normalizeText(`${type ?? ""} ${description ?? ""}`);

  if (
    rawType.includes("intern") ||
    rawType.includes("estagio") ||
    rawType === "vacancy_type_internship" ||
    /\bestagio\b/.test(text)
  ) {
    return "estagio";
  }

  if (
    rawType.includes("temporary") ||
    rawType.includes("temporar") ||
    rawType === "vacancy_type_temporary" ||
    /\btemporari[oa]\b/.test(text)
  ) {
    return "temporario";
  }

  if (rawType.includes("freelancer") || /\bfreelanc/.test(text) || /\bautonom[oa]\b/.test(text)) {
    return "pj";
  }

  if (/\bclt\b/.test(text) || text.includes("consolidacao das leis do trabalho")) {
    return "clt";
  }

  if (/\bpj\b/.test(text) || text.includes("pessoa juridica")) {
    return "pj";
  }

  return "nao_informado";
}

function makeLocationText(job, state, workplaceType) {
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

  if (workplaceType === "remote") {
    return "Remoto - Brasil";
  }

  if (job.country) {
    return String(job.country).trim();
  }

  return "Local não informado";
}

function normalizeSkills(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .map((skill) => {
          if (typeof skill === "string") {
            return skill.trim();
          }

          if (skill && typeof skill === "object") {
            return String(
              skill.name ?? skill.label ?? skill.title ?? skill.displayName ?? "",
            ).trim();
          }

          return "";
        })
        .filter(Boolean),
    ),
  ];
}

function inferSkills(description = "") {
  const text = String(description ?? "");

  return SKILL_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
}

function mergeSkills(...groups) {
  return [...new Set(groups.flat().filter(Boolean))];
}

function mapGupyJob(job) {
  const description = cleanDescription(job.description);
  const state = normalizeState(job.state);
  const workplaceType = normalizeWorkplaceType(job.workplaceType, job.isRemoteWork === true);

  const apiSkills = normalizeSkills(job.skills);
  const skills = mergeSkills(apiSkills, inferSkills(description));

  return {
    source: "gupy",
    external_id: String(job.id ?? "").trim(),
    title: String(job.name ?? "").trim(),
    company: String(job.careerPageName ?? "Empresa não informada").trim(),
    category: inferCategory(job.name, description),
    seniority: inferSeniority(job.name),
    workplace_type: workplaceType,
    contract_type: normalizeContractType(job.type, description),
    location_text: makeLocationText(job, state, workplaceType),
    city: job.city ? String(job.city).trim() : null,
    state,
    country: job.country ? String(job.country).trim() : "Brasil",
    application_url: String(job.jobUrl ?? "").trim(),
    description,
    application_deadline: job.applicationDeadline || null,
    skills,
    published_at: job.publishedDate || null,
    active: true,
  };
}

async function fetchJson(url, retries = MAX_RETRIES) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "Radar-Vagas/1.0",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Gupy respondeu ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      lastError = error;

      if (attempt < retries) {
        await sleep(800 * (attempt + 1));
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError;
}

async function fetchJobs(offset = 0, filters = {}) {
  return fetchJson(buildGupySearchUrl(offset, PAGE_SIZE, filters));
}

function addJobsToMap(jobs, byId) {
  let newOnPage = 0;

  for (const job of jobs) {
    if (!job?.id) {
      continue;
    }

    const id = String(job.id);

    if (!byId.has(id)) {
      newOnPage += 1;
    }

    byId.set(id, job);
  }

  return newOnPage;
}

async function collectPartition(label, filters, byId) {
  let offset = 0;
  let page = 1;
  let received = 0;
  let added = 0;
  let capped = false;

  console.log(`\n--- ${label} ---`);

  while (true) {
    const data = await fetchJobs(offset, filters);
    const jobs = extractGupyRows(data);
    const newOnPage = addJobsToMap(jobs, byId);

    received += jobs.length;
    added += newOnPage;

    console.log(
      `[${label}] página=${page} offset=${offset} recebidas=${jobs.length} novas=${newOnPage} únicas_globais=${byId.size}`,
    );

    if (jobs.length === 0 || jobs.length < PAGE_SIZE) {
      break;
    }

    if (newOnPage === 0) {
      console.warn(`[${label}] página repetida sem novas vagas; bloco encerrado para evitar loop.`);
      break;
    }

    if (offset >= MAX_OFFSET) {
      capped = true;
      console.warn(
        `[${label}] atingiu o teto de paginação da Gupy em ${MAX_OFFSET + PAGE_SIZE} resultados.`,
      );
      break;
    }

    offset += PAGE_SIZE;
    page += 1;
    await sleep(PAGE_DELAY_MS);
  }

  console.log(
    `[${label}] fim | recebidas=${received} | adicionadas_ao_total=${added} | capped=${capped}`,
  );

  return { label, filters, received, added, capped };
}

async function splitCappedType(jobType, byId, diagnostics) {
  console.log(`\nTipo ${jobType} ultrapassou o teto. Dividindo por modalidade...`);

  for (const workplaceType of WORKPLACE_TYPES) {
    const label = `${jobType} | ${workplaceType}`;
    const result = await collectPartition(label, { type: jobType, workplaceType }, byId);

    diagnostics.push(result);

    if (!result.capped) {
      continue;
    }

    console.log(`\nBloco ${label} ainda ultrapassou o teto. Dividindo por estado...`);

    for (const state of BRAZIL_STATE_NAMES) {
      const stateResult = await collectPartition(
        `${label} | ${state}`,
        {
          type: jobType,
          workplaceType,
          state,
        },
        byId,
      );

      diagnostics.push(stateResult);

      if (stateResult.capped) {
        console.warn(
          `ATENÇÃO: ${label} | ${state} ainda atingiu o teto. Esse bloco precisa de uma subdivisão adicional.`,
        );
      }
    }
  }
}

async function collectAllJobs() {
  console.log("\nColetando TODAS as vagas públicas da Gupy...");
  console.log(
    "Estratégia: catálogo geral -> tipos de vaga -> modalidade/estado apenas quando necessário.",
  );

  const byId = new Map();
  const diagnostics = [];

  // Primeiro lote: pega as vagas mais recentes de forma global.
  const globalResult = await collectPartition("GERAL", {}, byId);
  diagnostics.push(globalResult);

  if (globalResult.capped) {
    console.log(
      "\nO catálogo geral atingiu o limite. Iniciando coleta particionada por tipo de vaga...",
    );

    for (const jobType of JOB_TYPES) {
      const result = await collectPartition(`TIPO ${jobType}`, { type: jobType }, byId);

      diagnostics.push(result);

      if (result.capped) {
        await splitCappedType(jobType, byId, diagnostics);
      }
    }
  }

  const unresolved = diagnostics.filter((item) => item.capped && item.filters?.state);

  console.log("\n====================================");
  console.log("DIAGNÓSTICO DE PAGINAÇÃO");
  console.log("====================================");
  console.log(`Blocos consultados: ${diagnostics.length}`);
  console.log(`Blocos finais ainda no teto: ${unresolved.length}`);

  if (unresolved.length > 0) {
    console.warn(
      "Ainda existem blocos acima do teto. O JSON continua útil, mas não considere a cobertura 100% completa nesses blocos.",
    );

    console.table(
      unresolved.map((item) => ({
        tipo: item.filters.type ?? "",
        modalidade: item.filters.workplaceType ?? "",
        estado: item.filters.state ?? "",
        recebidas: item.received,
      })),
    );
  } else {
    console.log("Nenhum bloco final ficou preso no teto de 10 mil resultados.");
  }

  return [...byId.values()];
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

function summarize(jobs, field) {
  const result = {};

  for (const job of jobs) {
    const value = job[field] ?? "nao_informado";
    result[value] = (result[value] ?? 0) + 1;
  }

  return result;
}

async function main() {
  console.log("====================================");
  console.log("Radar Vagas - Gupy Dry Run");
  console.log("Fonte única: Gupy");
  console.log("TODOS os tipos de vaga pública");
  console.log(`Janela: últimos ${WINDOW_DAYS} dias`);
  console.log("NENHUM dado será gravado no Supabase");
  console.log("====================================");

  const rawJobs = await collectAllJobs();
  if (rawJobs.length === 0) {
    throw new Error("Gupy retornou um catálogo vazio; a coleta não será publicada.");
  }
  const mappedJobs = rawJobs.map(mapGupyJob);

  const recentJobs = [];
  let outsideWindow = 0;
  let withoutPublishedDate = 0;

  for (const job of mappedJobs) {
    if (!job.published_at || !parseDate(job.published_at)) {
      withoutPublishedDate += 1;
      continue;
    }

    if (!isWithinWindow(job.published_at, WINDOW_DAYS)) {
      outsideWindow += 1;
      continue;
    }

    recentJobs.push(job);
  }

  const validJobs = [];
  const invalidJobs = [];

  for (const job of recentJobs) {
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

  validJobs.sort((a, b) => {
    const dateA = parseDate(a.published_at)?.getTime() ?? 0;
    const dateB = parseDate(b.published_at)?.getTime() ?? 0;
    return dateB - dateA;
  });

  console.log("\n====================================");
  console.log("RESUMO");
  console.log("====================================");

  console.log(`Vagas públicas únicas encontradas: ${rawJobs.length}`);
  console.log(`Fora dos últimos ${WINDOW_DAYS} dias: ${outsideWindow}`);
  console.log(`Sem publishedDate confiável: ${withoutPublishedDate}`);
  console.log(`Vagas únicas na janela: ${recentJobs.length}`);
  console.log(`Vagas válidas na janela: ${validJobs.length}`);
  console.log(`Vagas inválidas na janela: ${invalidJobs.length}`);

  console.log("\nModalidade:");
  console.table(summarize(validJobs, "workplace_type"));

  console.log("\nSenioridade:");
  console.table(summarize(validJobs, "seniority"));

  console.log("\nCategoria:");
  console.table(summarize(validJobs, "category"));

  console.log("\nContrato:");
  console.table(summarize(validJobs, "contract_type"));

  if (invalidJobs.length > 0) {
    console.log("\nAmostra de vagas inválidas:");
    console.table(invalidJobs.slice(0, 20));
  }

  await fs.writeFile(OUTPUT_FILE, JSON.stringify(validJobs, null, 2), "utf8");

  console.log("\n====================================");
  console.log("AMOSTRA DAS MAIS RECENTES");
  console.log("====================================\n");

  console.dir(validJobs.slice(0, 5), {
    depth: null,
    colors: true,
  });

  console.log("\n====================================");
  console.log("DRY RUN FINALIZADO");
  console.log(`JSON gerado em: ${OUTPUT_FILE}`);
  console.log(`O JSON contém somente vagas publicadas nos últimos ${WINDOW_DAYS} dias.`);
  console.log("Nenhum dado foi gravado no Supabase.");
  console.log("====================================");
}

main().catch((error) => {
  console.error("Falha fatal no coletor:", error instanceof Error ? error.message : error);

  process.exitCode = 1;
});
