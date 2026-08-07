import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_BASE = "https://api.ashbyhq.com/posting-api/job-board";
const BOARDS_FILE = path.join(__dirname, "ashby-boards.txt");
const OUTPUT_FILE = path.join(__dirname, "ashby-results.json");

const WINDOW_DAYS = 15;
const BOARD_CONCURRENCY = 6;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;

const STARTER_BOARDS = [
  ["ashby", "Ashby"],
  ["quorum", "Quorum"],
  ["Agent", "Agent"],
  ["dandy", "Dandy"],
  ["depot", "Depot"],
  ["fluidstack", "Fluidstack"],
  ["substrate", "Substrate"],
  ["omniscient", "Omniscient"],
  ["trm-labs", "TRM Labs"],
];

const BRAZIL_STATES = new Map([
  ["acre", "AC"],
  ["alagoas", "AL"],
  ["amapa", "AP"],
  ["amazonas", "AM"],
  ["bahia", "BA"],
  ["ceara", "CE"],
  ["distrito federal", "DF"],
  ["espirito santo", "ES"],
  ["goias", "GO"],
  ["maranhao", "MA"],
  ["mato grosso", "MT"],
  ["mato grosso do sul", "MS"],
  ["minas gerais", "MG"],
  ["para", "PA"],
  ["paraiba", "PB"],
  ["parana", "PR"],
  ["pernambuco", "PE"],
  ["piaui", "PI"],
  ["rio de janeiro", "RJ"],
  ["rio grande do norte", "RN"],
  ["rio grande do sul", "RS"],
  ["rondonia", "RO"],
  ["roraima", "RR"],
  ["santa catarina", "SC"],
  ["sao paulo", "SP"],
  ["sergipe", "SE"],
  ["tocantins", "TO"],
]);

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
  ["ETL", /\betl\b/i],
  ["ELT", /\belt\b/i],
  ["Git", /\bgit\b/i],
  ["Pandas", /\bpandas\b/i],
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
  ["C#", /(?:^|[\s,;(])c#(?:[\s,;).]|$)/i],
  ["C++", /(?:^|[\s,;(])c\+\+(?:[\s,;).]|$)/i],
  ["Go", /\bgolang\b/i],
  ["Ruby", /\bruby\b/i],
  ["PHP", /\bphp\b/i],
  ["SAP", /\bsap\b/i],
  ["Salesforce", /\bsalesforce\b/i],
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
  if (!value) return null;
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

function cleanDescription(job) {
  const plain = String(job?.descriptionPlain ?? "").trim();
  if (plain) return plain;

  const html = String(job?.descriptionHtml ?? "");
  if (!html) return null;

  return (
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<li[^>]*>/gi, "• ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/\u00a0/g, " ")
      .replace(/\r/g, "")
      .replace(/[ \t]+/g, " ")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim() || null
  );
}

function externalId(boardName, job) {
  const url = String(job?.jobUrl ?? job?.applyUrl ?? "").trim();

  if (url) {
    try {
      const parsed = new URL(url);
      const parts = parsed.pathname.split("/").filter(Boolean);
      const maybeId = parts.at(-1);

      if (maybeId) {
        return `${boardName}:${maybeId}`;
      }
    } catch {
      // cai no hash abaixo
    }
  }

  const basis = [boardName, job?.title ?? "", job?.location ?? "", job?.publishedAt ?? ""].join(
    "|",
  );

  const hash = crypto.createHash("sha256").update(basis).digest("hex").slice(0, 24);

  return `${boardName}:${hash}`;
}

function normalizeWorkplaceType(job) {
  const workplace = normalizeText(job?.workplaceType);
  const location = normalizeText(job?.location);

  if (
    job?.isRemote === true ||
    workplace === "remote" ||
    location.includes("remote") ||
    location.includes("remoto")
  ) {
    return "remote";
  }

  if (workplace === "hybrid" || workplace === "hibrido") {
    return "hybrid";
  }

  if (workplace === "onsite" || workplace === "on-site" || workplace === "presencial") {
    return "onsite";
  }

  return "unknown";
}

function inferSeniority(title) {
  const text = normalizeText(title);

  if (
    /\bintern(ship)?\b/.test(text) ||
    /\bestagio\b/.test(text) ||
    /\bestagiari[oa]\b/.test(text) ||
    /\btrainee\b/.test(text) ||
    /\bapprentice\b/.test(text)
  ) {
    return "estagio";
  }

  if (/\bjunior\b/.test(text) || /\bjr\b/.test(text) || /\bentry.level\b/.test(text)) {
    return "junior";
  }

  if (/\bpleno\b/.test(text) || /\bmid.level\b/.test(text) || /\bmid\b/.test(text)) {
    return "pleno";
  }

  if (/\bsenior\b/.test(text) || /\bsr\b/.test(text)) {
    return "senior";
  }

  if (
    /\bstaff\b/.test(text) ||
    /\bprincipal\b/.test(text) ||
    /\blead\b/.test(text) ||
    /\bspecialist\b/.test(text) ||
    /\bespecialista\b/.test(text) ||
    /\bmanager\b/.test(text) ||
    /\bdirector\b/.test(text) ||
    /\bhead\b/.test(text)
  ) {
    return "especialista";
  }

  return "nao_informado";
}

function inferCategory(job) {
  const text = normalizeText([job?.title, job?.department, job?.team].filter(Boolean).join(" "));

  const rules = [
    [
      "Dados e Analytics",
      [
        /\bdata analyst\b/,
        /\banalista de dados\b/,
        /\bdata scientist\b/,
        /\bcientista de dados\b/,
        /\bdata engineer\b/,
        /\bengenheir[oa] de dados\b/,
        /\banalytics\b/,
        /\bmachine learning\b/,
      ],
    ],
    [
      "Business Intelligence",
      [/\bbusiness intelligence\b/, /\banalista de bi\b/, /\bbi analyst\b/],
    ],
    [
      "Tecnologia",
      [
        /\bsoftware\b/,
        /\bdeveloper\b/,
        /\bengineering\b/,
        /\bengineer\b/,
        /\bdevops\b/,
        /\bsre\b/,
        /\bplatform\b/,
        /\bsecurity\b/,
        /\bcyber\b/,
        /\bcloud\b/,
        /\binfrastructure\b/,
        /\bit\b/,
        /\bqa\b/,
      ],
    ],
    ["Produto", [/\bproduct\b/, /\bproduto\b/, /\bux\b/, /\bui\b/]],
    [
      "Comercial e Vendas",
      [
        /\bsales\b/,
        /\bcommercial\b/,
        /\bcomercial\b/,
        /\bvendas?\b/,
        /\baccount executive\b/,
        /\baccount manager\b/,
        /\bbusiness development\b/,
        /\bsdr\b/,
        /\bbdr\b/,
      ],
    ],
    [
      "Marketing e Growth",
      [
        /\bmarketing\b/,
        /\bgrowth\b/,
        /\bbrand\b/,
        /\bcontent\b/,
        /\bcommunications?\b/,
        /\brevenue operations\b/,
        /\brevops\b/,
      ],
    ],
    [
      "Financeiro e Contábil",
      [
        /\bfinance\b/,
        /\bfinancial\b/,
        /\baccounting\b/,
        /\bcontabil/,
        /\btreasury\b/,
        /\btax\b/,
        /\bfiscal\b/,
      ],
    ],
    [
      "Recursos Humanos",
      [
        /\bpeople\b/,
        /\bhuman resources\b/,
        /\brecruit/,
        /\btalent\b/,
        /\brecursos humanos\b/,
        /\brh\b/,
      ],
    ],
    [
      "Logística e Operações",
      [
        /\boperations?\b/,
        /\blogistic/,
        /\bsupply chain\b/,
        /\bwarehouse\b/,
        /\btransport/,
        /\bfulfillment\b/,
      ],
    ],
    ["Saúde", [/\bhealth\b/, /\bmedical\b/, /\bclinical\b/, /\bnurse\b/, /\bsaude\b/, /\benferm/]],
    [
      "Administrativo",
      [/\badministrative\b/, /\badministration\b/, /\badministrativ/, /\breception/, /\bsecretar/],
    ],
    [
      "Atendimento e Suporte",
      [
        /\bcustomer success\b/,
        /\bcustomer support\b/,
        /\bcustomer service\b/,
        /\bcustomer experience\b/,
        /\bsupport\b/,
        /\batendimento\b/,
      ],
    ],
    ["Jurídico", [/\blegal\b/, /\bcounsel\b/, /\bcompliance\b/, /\bjuridic/]],
    ["Compras e Suprimentos", [/\bprocurement\b/, /\bsourcing\b/, /\bpurchasing\b/, /\bcompras\b/]],
    ["Educação", [/\beducation\b/, /\bteacher\b/, /\binstructor\b/, /\bprofessor/]],
    [
      "Negócios e Estratégia",
      [
        /\bstrategy\b/,
        /\bstrategic\b/,
        /\bbusiness analyst\b/,
        /\bbusiness operations\b/,
        /\bplanejamento\b/,
      ],
    ],
    ["Design", [/\bdesign\b/, /\bdesigner\b/, /\bcreative\b/]],
  ];

  for (const [category, patterns] of rules) {
    if (patterns.some((pattern) => pattern.test(text))) {
      return category;
    }
  }

  return "Outros";
}

function normalizeContractType(employmentType) {
  const type = normalizeText(employmentType).replace(/[\s_-]+/g, "");

  if (type === "intern") {
    return "estagio";
  }

  if (type === "temporary") {
    return "temporario";
  }

  // FullTime / PartTime / Contract não equivalem automaticamente a CLT/PJ.
  return "nao_informado";
}

function inferSkills(description = "") {
  const text = String(description ?? "");

  return SKILL_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
}

function mapCountry(value) {
  const raw = String(value ?? "").trim();
  const text = normalizeText(raw);

  if (!raw) return null;

  if (text === "br" || text === "bra" || text === "brazil" || text === "brasil") {
    return "Brasil";
  }

  if (
    text === "us" ||
    text === "usa" ||
    text === "united states" ||
    text === "united states of america"
  ) {
    return "Estados Unidos";
  }

  if (text === "uk" || text === "gb" || text === "gbr" || text === "united kingdom") {
    return "Reino Unido";
  }

  return raw;
}

function parseLocation(job, workplaceType) {
  const primaryLocation = String(job?.location ?? "").trim();
  const postal = job?.address?.postalAddress ?? {};

  let city = String(postal?.addressLocality ?? "").trim() || null;
  let stateRaw = String(postal?.addressRegion ?? "").trim();
  let state = null;
  let country = mapCountry(postal?.addressCountry);

  const stateText = normalizeText(stateRaw);

  if (stateText) {
    if (/^[A-Za-z]{2}$/.test(stateRaw)) {
      state = stateRaw.toUpperCase();
    } else if (BRAZIL_STATES.has(stateText)) {
      state = BRAZIL_STATES.get(stateText);
    }
  }

  const locationTextNormalized = normalizeText(primaryLocation);

  if (!state) {
    for (const [name, uf] of BRAZIL_STATES.entries()) {
      if (locationTextNormalized.includes(name)) {
        state = uf;
        break;
      }
    }
  }

  if (
    !country &&
    (state ||
      locationTextNormalized.includes("brazil") ||
      locationTextNormalized.includes("brasil"))
  ) {
    country = "Brasil";
  }

  if (!city && primaryLocation) {
    const first = primaryLocation.split(",")[0]?.trim();

    if (first && !/remote|remoto|hybrid|hibrid|worldwide|global|multiple/i.test(first)) {
      city = first;
    }
  }

  return {
    location_text:
      primaryLocation || (workplaceType === "remote" ? "Remoto" : "Local não informado"),
    city,
    state,
    country,
  };
}

function salaryFromCompensation(compensation) {
  const result = {
    salary_min: null,
    salary_max: null,
    salary_currency: null,
    salary_interval: null,
    salary_description: null,
  };

  if (!compensation || typeof compensation !== "object") {
    return result;
  }

  result.salary_description =
    compensation.scrapeableCompensationSalarySummary ??
    compensation.compensationTierSummary ??
    null;

  const components = Array.isArray(compensation.summaryComponents)
    ? compensation.summaryComponents
    : [];

  const salary = components.find(
    (component) => normalizeText(component?.compensationType) === "salary",
  );

  if (salary) {
    const min = Number(salary.minValue);
    const max = Number(salary.maxValue);

    result.salary_min = Number.isFinite(min) ? min : null;
    result.salary_max = Number.isFinite(max) ? max : null;
    result.salary_currency = salary.currencyCode ?? null;
    result.salary_interval = salary.interval ?? null;
  }

  return result;
}

function mapJob(board, job) {
  const description = cleanDescription(job);
  const workplaceType = normalizeWorkplaceType(job);
  const location = parseLocation(job, workplaceType);
  const salary = salaryFromCompensation(job?.compensation);

  return {
    source: "ashby",
    external_id: externalId(board.boardName, job),
    title: String(job?.title ?? "").trim(),
    company: String(board.company ?? board.boardName).trim(),
    category: inferCategory(job),
    seniority: inferSeniority(job?.title),
    workplace_type: workplaceType,
    contract_type: normalizeContractType(job?.employmentType),
    location_text: location.location_text,
    city: location.city,
    state: location.state,
    country: location.country,
    application_url: String(job?.jobUrl ?? job?.applyUrl ?? "").trim(),
    apply_url: String(job?.applyUrl ?? "").trim() || null,
    description,
    application_deadline: null,
    skills: inferSkills(description),
    published_at: job?.publishedAt ?? null,
    published_at_source: "publishedAt",
    department: job?.department ?? null,
    team: job?.team ?? null,
    source_employment_type: job?.employmentType ?? null,
    source_workplace_type: job?.workplaceType ?? null,
    salary_min: salary.salary_min,
    salary_max: salary.salary_max,
    salary_currency: salary.salary_currency,
    salary_interval: salary.salary_interval,
    salary_description: salary.salary_description,
    ashby_board: board.boardName,
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

      if (response.status === 404) {
        return null;
      }

      if (response.status === 429 && attempt < retries) {
        const retryAfter = Number(response.headers.get("retry-after") ?? 0);

        await sleep(retryAfter > 0 ? retryAfter * 1000 : 2_000 * (attempt + 1));

        continue;
      }

      if (!response.ok) {
        throw new Error(`Ashby respondeu ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      lastError = error;

      if (attempt < retries) {
        await sleep(1_000 * (attempt + 1));
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError;
}

async function mapPool(items, worker, concurrency) {
  const results = new Array(items.length);
  let cursor = 0;

  async function run() {
    while (true) {
      const index = cursor;
      cursor += 1;

      if (index >= items.length) {
        return;
      }

      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length || 1) }, () => run()));

  return results;
}

function parseBoardLine(line) {
  let raw = String(line).replace(/#.*/, "").trim();

  if (!raw) {
    return null;
  }

  let company = null;

  if (raw.includes("=")) {
    const index = raw.indexOf("=");
    company = raw.slice(index + 1).trim() || null;
    raw = raw.slice(0, index).trim();
  }

  raw = raw
    .replace(/^https?:\/\/jobs\.ashbyhq\.com\//i, "")
    .replace(/^https?:\/\/api\.ashbyhq\.com\/posting-api\/job-board\//i, "");

  const boardName = raw.split(/[/?#]/)[0].trim();

  if (!boardName) {
    return null;
  }

  return {
    boardName,
    company: company ?? boardName,
  };
}

async function loadBoards() {
  const boards = new Map();

  for (const [boardName, company] of STARTER_BOARDS) {
    boards.set(boardName.toLowerCase(), {
      boardName,
      company,
    });
  }

  try {
    const content = await fs.readFile(BOARDS_FILE, "utf8");

    for (const line of content.split(/\r?\n/)) {
      const parsed = parseBoardLine(line);

      if (parsed) {
        boards.set(parsed.boardName.toLowerCase(), parsed);
      }
    }

    console.log(`Boards Ashby carregados/mesclados: ${boards.size} (${BOARDS_FILE})`);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }

    const text = [
      "# Ashby boards - Radar Vagas",
      "# Formato: board=Nome da Empresa",
      "# URL completa jobs.ashbyhq.com/board também funciona.",
      "",
      ...[...boards.values()]
        .sort((a, b) => a.boardName.localeCompare(b.boardName))
        .map((item) => `${item.boardName}=${item.company}`),
      "",
    ].join("\n");

    await fs.writeFile(BOARDS_FILE, text, "utf8");
    console.log(`Arquivo criado: ${BOARDS_FILE}`);
  }

  return [...boards.values()].sort((a, b) => a.boardName.localeCompare(b.boardName));
}

async function fetchBoard(board) {
  const url = new URL(`${API_BASE}/${encodeURIComponent(board.boardName)}`);

  url.searchParams.set("includeCompensation", "true");

  const data = await fetchJson(url);

  if (!data) {
    return null;
  }

  if (!Array.isArray(data.jobs)) {
    throw new Error(`[${board.boardName}] resposta não contém jobs[]`);
  }

  return {
    ...board,
    apiVersion: data.apiVersion ?? null,
    jobs: data.jobs,
  };
}

function validateJob(job) {
  const errors = [];

  if (!job.external_id) errors.push("external_id");
  if (!job.title) errors.push("title");
  if (!job.company) errors.push("company");
  if (!job.application_url) errors.push("application_url");
  if (!job.published_at) errors.push("published_at");

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
  console.log("Radar Vagas - Ashby Dry Run");
  console.log(`Janela: últimos ${WINDOW_DAYS} dias`);
  console.log("Somente vagas públicas/listadas");
  console.log("NENHUM dado será gravado no Supabase");
  console.log("====================================");

  const boards = await loadBoards();

  let checked = 0;
  let validBoards = 0;
  let invalidBoards = 0;

  const results = await mapPool(
    boards,
    async (board) => {
      try {
        const result = await fetchBoard(board);

        checked += 1;

        if (result) {
          validBoards += 1;
        } else {
          invalidBoards += 1;
        }

        console.log(
          `Boards verificados: ${checked}/${boards.length} | válidos=${validBoards} | inválidos=${invalidBoards}`,
        );

        return result;
      } catch (error) {
        checked += 1;
        invalidBoards += 1;

        console.warn(
          `[${board.boardName}] falhou: ${error instanceof Error ? error.message : error}`,
        );

        return null;
      }
    },
    BOARD_CONCURRENCY,
  );

  const validResults = results.filter(Boolean);

  const allPublic = [];
  let unlistedIgnored = 0;
  let oldIgnored = 0;

  for (const board of validResults) {
    for (const rawJob of board.jobs) {
      if (rawJob?.isListed === false) {
        unlistedIgnored += 1;
        continue;
      }

      if (!isWithinWindow(rawJob?.publishedAt, WINDOW_DAYS)) {
        oldIgnored += 1;
        continue;
      }

      allPublic.push(mapJob(board, rawJob));
    }
  }

  const byExternalId = new Map();

  for (const job of allPublic) {
    byExternalId.set(job.external_id, job);
  }

  const uniqueJobs = [...byExternalId.values()];
  const validJobs = [];
  const invalidJobs = [];

  for (const job of uniqueJobs) {
    const errors = validateJob(job);

    if (errors.length) {
      invalidJobs.push({
        external_id: job.external_id,
        title: job.title,
        errors,
      });
    } else {
      validJobs.push(job);
    }
  }

  const withSalary = validJobs.filter(
    (job) => job.salary_min !== null || job.salary_max !== null || job.salary_description,
  ).length;

  console.log("\n====================================");
  console.log("RESUMO");
  console.log("====================================");
  console.log(`Boards configurados: ${boards.length}`);
  console.log(`Boards válidos: ${validResults.length}`);
  console.log(`Boards inválidos: ${invalidBoards}`);
  console.log(
    `Vagas públicas encontradas nos boards: ${validResults.reduce(
      (sum, board) => sum + board.jobs.length,
      0,
    )}`,
  );
  console.log(`Vagas não listadas ignoradas: ${unlistedIgnored}`);
  console.log(`Vagas fora dos ${WINDOW_DAYS} dias: ${oldIgnored}`);
  console.log(`Vagas únicas na janela: ${uniqueJobs.length}`);
  console.log(`Vagas válidas: ${validJobs.length}`);
  console.log(`Vagas inválidas: ${invalidJobs.length}`);
  console.log(`Vagas com remuneração informada: ${withSalary}`);

  console.log("\nModalidade:");
  console.table(summarize(validJobs, "workplace_type"));

  console.log("\nSenioridade:");
  console.table(summarize(validJobs, "seniority"));

  console.log("\nCategoria:");
  console.table(summarize(validJobs, "category"));

  console.log("\nContrato:");
  console.table(summarize(validJobs, "contract_type"));

  console.log("\nEmployment type da fonte:");
  console.table(summarize(validJobs, "source_employment_type"));

  console.log("\nMoeda de remuneração:");
  console.table(summarize(validJobs, "salary_currency"));

  if (invalidJobs.length > 0) {
    console.log("\nAmostra de inválidas:");
    console.table(invalidJobs.slice(0, 20));
  }

  await fs.writeFile(OUTPUT_FILE, JSON.stringify(validJobs, null, 2), "utf8");

  console.log("\n====================================");
  console.log("AMOSTRA");
  console.log("====================================\n");

  console.dir(validJobs.slice(0, 5), {
    depth: null,
    colors: true,
  });

  console.log("\n====================================");
  console.log("DRY RUN FINALIZADO");
  console.log(`JSON gerado em: ${OUTPUT_FILE}`);
  console.log("Nenhum dado foi gravado no Supabase.");
  console.log("====================================");
}

main().catch((error) => {
  console.error("Falha fatal no coletor:", error instanceof Error ? error.message : error);

  process.exitCode = 1;
});
