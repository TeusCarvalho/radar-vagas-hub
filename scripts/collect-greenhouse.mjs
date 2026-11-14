import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_BASE = "https://boards-api.greenhouse.io/v1/boards";
const BOARDS_FILE = path.join(__dirname, "greenhouse-boards.txt");
const OUTPUT_FILE = path.join(__dirname, "greenhouse-results.json");

const WINDOW_DAYS = 7;
const BOARD_CONCURRENCY = 5;
const DETAIL_CONCURRENCY = 8;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;

// Lista inicial. O arquivo greenhouse-boards.txt é mesclado com esta lista.
// Novos board tokens podem ser adicionados no TXT, um por linha.
const STARTER_BOARDS = [
  "anthropic",
  "vercel",
  "mercury",
  "coinbase",
  "fireblocks",
  "kalshi",
  "layerzerolabs",
  "mesh",
  "stackblitz",
  "webflow",
  "figma",
  "scaleai",
  "helsing",
  "blackforestlabs",
  "imbue",
  "parloa",
  "labelbox",
  "contentful",
  "raisin",
  "getyourguide",
  "monzo",
  "typeform",
  "wolt",
  "nubank",
  "gitlab",
  "carta",
  "twilio",
  "circleci",
  "patreon",
  "axios",
  "remotecom",
];

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

const BRAZIL_STATE_NAMES = new Map([
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
  ["C#", /(?:^|[\s,;(])c#(?:[\s,;).]|$)/i],
  ["C++", /(?:^|[\s,;(])c\+\+(?:[\s,;).]|$)/i],
  ["Go", /(?:^|[\s,;(])golang(?:[\s,;).]|$)|(?:^|[\s,;(])go(?:[\s,;).]|$)/i],
  ["Ruby", /\bruby\b/i],
  ["PHP", /\bphp\b/i],
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

function decodeHtmlEntities(value) {
  return String(value)
    .replace(/&#x([0-9a-f]+);/gi, (match, hex) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    })
    .replace(/&#(\d+);/g, (match, dec) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    })
    .replace(/&([a-zA-Z]+);/g, (match, name) =>
      Object.prototype.hasOwnProperty.call(HTML_ENTITIES, name) ? HTML_ENTITIES[name] : match,
    );
}

function cleanHtml(value) {
  if (!value) {
    return null;
  }

  // Greenhouse pode devolver HTML convertido em entidades.
  let text = String(value);

  // Duas passagens resolvem casos como &amp;lt;p&amp;gt;
  text = decodeHtmlEntities(decodeHtmlEntities(text));

  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isSafeHttpUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function cutoffDate(days = WINDOW_DAYS) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function parseDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isWithinWindow(value, days = WINDOW_DAYS) {
  const date = parseDate(value);

  if (!date) {
    return false;
  }

  return date >= cutoffDate(days);
}

function inferSeniority(title) {
  const text = normalizeText(title);

  if (
    /\bestagio\b/.test(text) ||
    /\bestagiari[oa]\b/.test(text) ||
    /\bintern(ship)?\b/.test(text) ||
    /\btrainee\b/.test(text) ||
    /\bapprentice\b/.test(text)
  ) {
    return "estagio";
  }

  if (/\bjunior\b/.test(text) || /\bjr\b/.test(text) || /\bentry.level\b/.test(text)) {
    return "junior";
  }

  if (
    /\bpleno\b/.test(text) ||
    /\bpl\b/.test(text) ||
    /\bmid.level\b/.test(text) ||
    /\bmid\b/.test(text)
  ) {
    return "pleno";
  }

  if (/\bsenior\b/.test(text) || /\bsr\b/.test(text)) {
    return "senior";
  }

  if (
    /\bespecialista\b/.test(text) ||
    /\bspecialist\b/.test(text) ||
    /\blead\b/.test(text) ||
    /\bstaff\b/.test(text) ||
    /\bprincipal\b/.test(text) ||
    /\bmanager\b/.test(text) ||
    /\bgerente\b/.test(text) ||
    /\bdirector\b/.test(text)
  ) {
    return "especialista";
  }

  return "nao_informado";
}

function inferCategory(title, departments = []) {
  const deptText = departments
    .map((item) => item?.name ?? "")
    .filter(Boolean)
    .join(" ");

  const text = normalizeText(`${title ?? ""} ${deptText}`);

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
        /\bmachine learning\b/,
      ],
    ],
    [
      "Business Intelligence",
      [/\bbusiness intelligence\b/, /\banalista de bi\b/, /\bconsultor(?:a)? de bi\b/],
    ],
    [
      "Tecnologia",
      [
        /\bsoftware\b/,
        /\bdeveloper\b/,
        /\bengineer\b/,
        /\bengineering\b/,
        /\bdevops\b/,
        /\bsre\b/,
        /\bquality assurance\b/,
        /\bqa\b/,
        /\bsecurity\b/,
        /\bcyber\b/,
        /\binfrastructure\b/,
        /\bplatform\b/,
        /\bcloud\b/,
        /\bit\b/,
      ],
    ],
    ["Produto", [/\bproduct\b/, /\bproduto\b/, /\bux\b/, /\bui\b/, /\bresearcher\b/]],
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
        /\bperformance\b/,
        /\bseo\b/,
        /\bcontent\b/,
        /\bbrand\b/,
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
        /\bfiscal\b/,
        /\btreasury\b/,
        /\bcontroladoria\b/,
      ],
    ],
    [
      "Recursos Humanos",
      [
        /\bhuman resources\b/,
        /\bpeople\b/,
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
        /\bfleet\b/,
        /\bfulfillment\b/,
      ],
    ],
    [
      "Engenharia",
      [
        /\bmechanical engineer/,
        /\belectrical engineer/,
        /\bcivil engineer/,
        /\bmanufacturing engineer/,
        /\bengenharia\b/,
        /\bengenheir[oa]\b/,
      ],
    ],
    [
      "Saúde",
      [
        /\bhealth\b/,
        /\bclinical\b/,
        /\bmedical\b/,
        /\bnurse\b/,
        /\bpharma/,
        /\bsaude\b/,
        /\benferm/,
      ],
    ],
    [
      "Administrativo",
      [
        /\badministrative\b/,
        /\badministration\b/,
        /\badministrativ/,
        /\breception/,
        /\bsecretar/,
        /\boffice assistant\b/,
      ],
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
    ["Jurídico", [/\blegal\b/, /\bcounsel\b/, /\blawyer\b/, /\bjuridic/, /\bcompliance\b/]],
    [
      "Compras e Suprimentos",
      [/\bprocurement\b/, /\bsourcing\b/, /\bpurchasing\b/, /\bcompras\b/, /\bsuprimentos\b/],
    ],
    ["Educação", [/\beducation\b/, /\bteacher\b/, /\binstructor\b/, /\bprofessor/, /\beducacao\b/]],
    [
      "Negócios e Estratégia",
      [
        /\bbusiness analyst\b/,
        /\bstrategy\b/,
        /\bstrategic\b/,
        /\bbusiness operations\b/,
        /\bestrategia\b/,
        /\bplanejamento\b/,
      ],
    ],
    ["Design", [/\bdesign\b/, /\bdesigner\b/, /\bcreative\b/]],
  ];

  for (const [category, patterns] of categories) {
    if (patterns.some((pattern) => pattern.test(text))) {
      return category;
    }
  }

  return "Outros";
}

function flattenMetadata(metadata) {
  if (!Array.isArray(metadata)) {
    return "";
  }

  return metadata
    .map((item) => {
      if (!item || typeof item !== "object") {
        return "";
      }

      const name = item.name ?? item.label ?? "";
      const value = Array.isArray(item.value) ? item.value.join(" ") : (item.value ?? "");

      return `${name} ${value}`.trim();
    })
    .filter(Boolean)
    .join(" ");
}

function normalizeContractType(metadata, description = "") {
  const text = normalizeText(`${flattenMetadata(metadata)} ${description ?? ""}`);

  if (/\bintern(ship)?\b/.test(text) || /\bestagio\b/.test(text) || /\bapprentice\b/.test(text)) {
    return "estagio";
  }

  if (/\btemporary\b/.test(text) || /\bcontract temporary\b/.test(text)) {
    return "temporario";
  }

  if (
    /\bcontractor\b/.test(text) ||
    /\bfreelance\b/.test(text) ||
    /\b1099\b/.test(text) ||
    /\bpessoa juridica\b/.test(text) ||
    /\bpj\b/.test(text)
  ) {
    return "pj";
  }

  if (/\bfull.time\b/.test(text) || /\bpermanent\b/.test(text) || /\bclt\b/.test(text)) {
    return "clt";
  }

  return "nao_informado";
}

function inferSkills(description = "") {
  const text = String(description ?? "");

  return SKILL_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
}

function inferWorkplaceType(title, location, description = "") {
  const text = normalizeText(`${title ?? ""} ${location ?? ""} ${description ?? ""}`);

  if (
    /\bremote\b/.test(text) ||
    /\bremoto\b/.test(text) ||
    /\bhome office\b/.test(text) ||
    /\bwork from home\b/.test(text) ||
    /\banywhere\b/.test(text)
  ) {
    return "remote";
  }

  if (/\bhybrid\b/.test(text) || /\bhibrid/.test(text)) {
    return "hybrid";
  }

  if (/\bon.site\b/.test(text) || /\bonsite\b/.test(text) || /\bpresencial\b/.test(text)) {
    return "onsite";
  }

  return "unknown";
}

function parseLocation(locationText = "", workplaceType = "unknown") {
  const raw = String(locationText ?? "").trim();

  if (!raw) {
    return {
      location_text: workplaceType === "remote" ? "Remoto" : "Local não informado",
      city: null,
      state: null,
      country: null,
    };
  }

  const normalized = normalizeText(raw);
  let state = null;

  for (const [name, uf] of BRAZIL_STATE_NAMES.entries()) {
    if (normalized.includes(name)) {
      state = uf;
      break;
    }
  }

  const ufMatch = raw.match(/(?:^|[,\s-])([A-Z]{2})(?:$|[,\s-])/);
  if (!state && ufMatch) {
    state = ufMatch[1];
  }

  let country = null;

  if (normalized.includes("brazil") || normalized.includes("brasil") || state) {
    country = "Brasil";
  } else if (normalized.includes("united states") || /\busa\b/i.test(raw)) {
    country = "Estados Unidos";
  } else if (normalized.includes("united kingdom") || /\buk\b/i.test(raw)) {
    country = "Reino Unido";
  } else if (normalized.includes("canada")) {
    country = "Canadá";
  } else if (normalized.includes("germany")) {
    country = "Alemanha";
  } else if (normalized.includes("france")) {
    country = "França";
  } else if (normalized.includes("spain")) {
    country = "Espanha";
  } else if (normalized.includes("portugal")) {
    country = "Portugal";
  }

  let city = null;
  const firstPart = raw.split(",")[0]?.trim();

  if (firstPart && !/remote|remoto|hybrid|hibrid|anywhere|worldwide|global/i.test(firstPart)) {
    city = firstPart;
  }

  return {
    location_text: raw,
    city,
    state,
    country,
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

      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("retry-after") ?? 0);
        const waitMs = retryAfter > 0 ? retryAfter * 1000 : 2_000 * (attempt + 1);

        if (attempt < retries) {
          await sleep(waitMs);
          continue;
        }
      }

      if (!response.ok) {
        throw new Error(`Greenhouse respondeu ${response.status} ${response.statusText}`);
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

async function loadBoards() {
  const tokens = new Set(STARTER_BOARDS.map((item) => item.trim().toLowerCase()).filter(Boolean));

  try {
    const content = await fs.readFile(BOARDS_FILE, "utf8");

    for (const line of content.split(/\r?\n/)) {
      const clean = line
        .replace(/#.*/, "")
        .trim()
        .replace(/^https?:\/\/(?:job-boards|boards)\.greenhouse\.io\//i, "")
        .replace(/\/.*$/, "")
        .toLowerCase();

      if (clean) {
        tokens.add(clean);
      }
    }

    console.log(`Boards carregados/mesclados: ${tokens.size} (${BOARDS_FILE})`);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }

    const starterText = [
      "# Greenhouse board tokens - Radar Vagas",
      "# Um por linha. Pode colar também a URL completa do board.",
      "",
      ...[...tokens].sort(),
      "",
    ].join("\n");

    await fs.writeFile(BOARDS_FILE, starterText, "utf8");

    console.log(`Arquivo de boards criado com ${tokens.size} seeds: ${BOARDS_FILE}`);
  }

  return [...tokens].sort();
}

async function fetchBoard(boardToken) {
  const board = await fetchJson(`${API_BASE}/${encodeURIComponent(boardToken)}`, 1);

  if (!board) {
    return null;
  }

  const jobs = await fetchJson(`${API_BASE}/${encodeURIComponent(boardToken)}/jobs?content=true`);

  if (!jobs || !Array.isArray(jobs.jobs)) {
    return {
      boardToken,
      companyName: board?.name ?? boardToken,
      jobs: [],
    };
  }

  return {
    boardToken,
    companyName: board?.name ?? boardToken,
    jobs: jobs.jobs,
  };
}

async function fetchJobDetail(boardToken, jobId) {
  return fetchJson(
    `${API_BASE}/${encodeURIComponent(boardToken)}/jobs/${encodeURIComponent(jobId)}`,
    1,
  );
}

function mapJob({ boardToken, companyName, summary, detail }) {
  const sourceData = detail ?? summary;

  const description = cleanHtml(sourceData?.content ?? summary?.content ?? "");

  const title = String(sourceData?.title ?? summary?.title ?? "").trim();

  const locationText = String(
    sourceData?.location?.name ?? summary?.location?.name ?? sourceData?.location ?? "",
  ).trim();

  const workplaceType = inferWorkplaceType(title, locationText, description);

  const location = parseLocation(locationText, workplaceType);

  const departments = Array.isArray(summary?.departments) ? summary.departments : [];

  const firstPublished = detail?.first_published ?? detail?.firstPublished ?? null;

  const updatedAt = detail?.updated_at ?? summary?.updated_at ?? null;

  const effectivePublishedAt = firstPublished ?? updatedAt;

  return {
    source: "greenhouse",
    external_id: `${boardToken}:${sourceData?.id ?? summary?.id ?? ""}`,
    title,
    company: String(detail?.company_name ?? companyName ?? boardToken).trim(),
    category: inferCategory(title, departments),
    seniority: inferSeniority(title),
    workplace_type: workplaceType,
    contract_type: normalizeContractType(sourceData?.metadata ?? summary?.metadata, description),
    location_text: location.location_text,
    city: location.city,
    state: location.state,
    country: location.country,
    application_url: String(sourceData?.absolute_url ?? summary?.absolute_url ?? "").trim(),
    description,
    application_deadline: detail?.application_deadline ?? null,
    skills: inferSkills(description),
    published_at: effectivePublishedAt,
    updated_at: updatedAt,
    published_at_source: firstPublished ? "first_published" : "updated_at_fallback",
    board_token: boardToken,
    active: true,
  };
}

function validateJob(job) {
  const errors = [];

  if (!job.external_id || job.external_id.endsWith(":")) {
    errors.push("external_id");
  }

  if (!job.title) {
    errors.push("title");
  }

  if (!job.company) {
    errors.push("company");
  }

  if (!job.application_url || !isSafeHttpUrl(job.application_url)) {
    errors.push("application_url");
  }

  if (!job.published_at) {
    errors.push("published_at");
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
  console.log("Radar Vagas - Greenhouse Dry Run");
  console.log(`Janela: últimos ${WINDOW_DAYS} dias`);
  console.log("NENHUM dado será gravado no Supabase");
  console.log("====================================");

  const boardTokens = await loadBoards();

  let checked = 0;
  let validBoards = 0;
  let invalidBoards = 0;

  const boardResults = await mapPool(
    boardTokens,
    async (boardToken) => {
      try {
        const result = await fetchBoard(boardToken);

        checked += 1;

        if (result) {
          validBoards += 1;
        } else {
          invalidBoards += 1;
        }

        if (checked % 5 === 0 || checked === boardTokens.length) {
          console.log(
            `Boards verificados: ${checked}/${boardTokens.length} | válidos=${validBoards} | inválidos=${invalidBoards}`,
          );
        }

        return result;
      } catch (error) {
        checked += 1;
        invalidBoards += 1;

        console.warn(`[${boardToken}] falhou: ${error instanceof Error ? error.message : error}`);

        return null;
      }
    },
    BOARD_CONCURRENCY,
  );

  const boards = boardResults.filter(Boolean);

  const recentCandidates = [];
  let allPublished = 0;
  let prospectPosts = 0;
  let oldByUpdate = 0;

  for (const board of boards) {
    for (const job of board.jobs) {
      // Prospect post não é uma vaga normal.
      if (job?.internal_job_id === null) {
        prospectPosts += 1;
        continue;
      }

      allPublished += 1;

      // updated_at >= first_published na prática; usamos como pré-filtro barato.
      if (!isWithinWindow(job?.updated_at, WINDOW_DAYS)) {
        oldByUpdate += 1;
        continue;
      }

      recentCandidates.push({
        boardToken: board.boardToken,
        companyName: board.companyName,
        summary: job,
      });
    }
  }

  console.log("\n====================================");
  console.log("ÍNDICE GREENHOUSE");
  console.log("====================================");
  console.log(`Boards consultados: ${boardTokens.length}`);
  console.log(`Boards válidos: ${boards.length}`);
  console.log(`Vagas públicas no índice: ${allPublished}`);
  console.log(`Prospect posts ignorados: ${prospectPosts}`);
  console.log(`Fora da janela pelo updated_at: ${oldByUpdate}`);
  console.log(`Candidatas a detalhe (<= ${WINDOW_DAYS} dias): ${recentCandidates.length}`);

  console.log("\nBuscando detalhes somente das candidatas recentes...");

  let detailDone = 0;

  const detailed = await mapPool(
    recentCandidates,
    async (candidate) => {
      let detail = null;

      try {
        detail = await fetchJobDetail(candidate.boardToken, candidate.summary.id);
      } catch (error) {
        console.warn(
          `[${candidate.boardToken}:${candidate.summary.id}] detalhe falhou: ${error instanceof Error ? error.message : error}`,
        );
      }

      detailDone += 1;

      if (detailDone % 50 === 0 || detailDone === recentCandidates.length) {
        console.log(`Detalhes processados: ${detailDone}/${recentCandidates.length}`);
      }

      return {
        ...candidate,
        detail,
      };
    },
    DETAIL_CONCURRENCY,
  );

  const mappedJobs = [];
  let rejectedByFirstPublished = 0;

  for (const item of detailed) {
    const job = mapJob(item);

    // Confirma a janela usando first_published quando disponível.
    // Se o detalhe não trouxer first_published, usa updated_at como fallback explícito.
    if (!isWithinWindow(job.published_at, WINDOW_DAYS)) {
      rejectedByFirstPublished += 1;
      continue;
    }

    mappedJobs.push(job);
  }

  const byExternalId = new Map();

  for (const job of mappedJobs) {
    byExternalId.set(job.external_id, job);
  }

  const uniqueJobs = [...byExternalId.values()];
  const validJobs = [];
  const invalidJobs = [];

  for (const job of uniqueJobs) {
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
  console.log("RESUMO");
  console.log("====================================");
  console.log(`Rejeitadas após confirmar first_published: ${rejectedByFirstPublished}`);
  console.log(`Vagas únicas na janela: ${uniqueJobs.length}`);
  console.log(`Vagas válidas: ${validJobs.length}`);
  console.log(`Vagas inválidas: ${invalidJobs.length}`);

  console.log("\nModalidade:");
  console.table(summarize(validJobs, "workplace_type"));

  console.log("\nSenioridade:");
  console.table(summarize(validJobs, "seniority"));

  console.log("\nCategoria:");
  console.table(summarize(validJobs, "category"));

  console.log("\nContrato:");
  console.table(summarize(validJobs, "contract_type"));

  console.log("\nBase da data publicada:");
  console.table(summarize(validJobs, "published_at_source"));

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
