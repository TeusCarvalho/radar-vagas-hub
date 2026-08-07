import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GLOBAL_API_BASE = "https://api.lever.co/v0/postings";
const EU_API_BASE = "https://api.eu.lever.co/v0/postings";

const SITES_FILE = path.join(__dirname, "lever-sites.txt");
const FIRST_SEEN_FILE = path.join(__dirname, "lever-first-seen.json");
const OUTPUT_FILE = path.join(__dirname, "lever-results.json");

const WINDOW_DAYS = 15;
const PAGE_SIZE = 100;
const SITE_CONCURRENCY = 5;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;
const PAGE_DELAY_MS = 150;

const STARTER_SITES = [
  ["spotify", "Spotify"],
  ["caseware", "Caseware"],
  ["highspot", "Highspot"],
  ["1password", "1Password"],
  ["aircall", "Aircall"],
  ["dnb", "Dun & Bradstreet"],
  ["teamsnap", "TeamSnap"],
  ["studypoint", "StudyPoint"],
  ["docsumo", "Docsumo"],
  ["eventbrite", "Eventbrite"],
  ["atlassian", "Atlassian"],
  ["shopify", "Shopify"],
  ["whereby", "Whereby"],
  ["coupa", "Coupa"],
  ["unlimit", "Unlimit"],
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

function cleanText(value) {
  if (!value) {
    return "";
  }

  return String(value)
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
    .trim();
}

function parseDate(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  // Lever costuma expor createdAt em epoch ms; também aceitamos ISO.
  const date =
    typeof value === "number" || /^\d+$/.test(String(value))
      ? new Date(Number(value))
      : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function cutoffDate(days = WINDOW_DAYS) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function isWithinWindow(value, days = WINDOW_DAYS) {
  const date = parseDate(value);
  return date ? date >= cutoffDate(days) : false;
}

function toIso(value) {
  const date = parseDate(value);
  return date ? date.toISOString() : null;
}

function buildDescription(job) {
  const parts = [];

  const direct = [
    job?.descriptionPlain,
    job?.openingPlain,
    job?.descriptionBodyPlain,
    job?.additionalPlain,
  ];

  for (const value of direct) {
    const clean = cleanText(value);

    if (clean && !parts.includes(clean)) {
      parts.push(clean);
    }
  }

  if (Array.isArray(job?.lists)) {
    for (const list of job.lists) {
      const title = cleanText(list?.text);
      const content = cleanText(list?.contentPlain ?? list?.content ?? "");

      const block = [title, content].filter(Boolean).join("\n");

      if (block && !parts.includes(block)) {
        parts.push(block);
      }
    }
  }

  if (parts.length === 0) {
    const fallback = cleanText(
      job?.description ?? job?.opening ?? job?.descriptionBody ?? job?.additional ?? "",
    );

    if (fallback) {
      parts.push(fallback);
    }
  }

  return parts.join("\n\n").trim() || null;
}

function normalizeWorkplaceType(value, location = "") {
  const text = normalizeText(`${value ?? ""} ${location ?? ""}`);

  if (text.includes("remote") || text.includes("remoto")) {
    return "remote";
  }

  if (text.includes("hybrid") || text.includes("hibrid")) {
    return "hybrid";
  }

  if (text.includes("on-site") || text.includes("onsite") || text.includes("presencial")) {
    return "onsite";
  }

  return "unknown";
}

function inferSeniority(title, level = "") {
  const text = normalizeText(`${title ?? ""} ${level ?? ""}`);

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

function inferCategory(title, categories = {}) {
  const text = normalizeText(
    [title, categories?.team, categories?.department].filter(Boolean).join(" "),
  );

  const categoryRules = [
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

  for (const [category, patterns] of categoryRules) {
    if (patterns.some((pattern) => pattern.test(text))) {
      return category;
    }
  }

  return "Outros";
}

function normalizeContractType(commitment, description = "") {
  const text = normalizeText(`${commitment ?? ""} ${description ?? ""}`);

  if (/\bintern(ship)?\b/.test(text) || /\bestagio\b/.test(text) || /\bapprentice\b/.test(text)) {
    return "estagio";
  }

  if (/\btemporary\b/.test(text) || /\bfixed.term\b/.test(text) || /\btemporari/.test(text)) {
    return "temporario";
  }

  if (
    /\bcontractor\b/.test(text) ||
    /\bfreelance\b/.test(text) ||
    /\bpessoa juridica\b/.test(text) ||
    /\bpj\b/.test(text)
  ) {
    return "pj";
  }

  // "Full-time" ou "Permanent" fora do Brasil não significa CLT.
  if (/\bclt\b/.test(text)) {
    return "clt";
  }

  return "nao_informado";
}

function inferSkills(description = "") {
  const text = String(description ?? "");

  return SKILL_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
}

function parseLocation(job) {
  const categories = job?.categories ?? {};
  const primary = String(categories?.location ?? "").trim();
  const allLocations = Array.isArray(categories?.allLocations)
    ? categories.allLocations
        .map(String)
        .map((x) => x.trim())
        .filter(Boolean)
    : [];

  const joined = [...new Set([primary, ...allLocations].filter(Boolean))].join(" | ");
  const normalized = normalizeText(joined);

  let state = null;

  for (const [name, uf] of BRAZIL_STATES.entries()) {
    if (normalized.includes(name)) {
      state = uf;
      break;
    }
  }

  const ufMatch = joined.match(/(?:^|[,\s-])([A-Z]{2})(?:$|[,\s-])/);
  if (!state && ufMatch) {
    state = ufMatch[1];
  }

  let country = null;

  if (job?.country) {
    country = String(job.country).trim().toUpperCase();
  } else if (state || normalized.includes("brazil") || normalized.includes("brasil")) {
    country = "BR";
  }

  let city = null;

  if (primary) {
    const first = primary.split(",")[0]?.trim();

    if (first && !/remote|remoto|hybrid|hibrid|worldwide|global|multiple/i.test(first)) {
      city = first;
    }
  }

  return {
    location_text: joined || "Local não informado",
    city,
    state,
    country,
  };
}

function normalizeSalary(job) {
  const range = job?.salaryRange;

  if (!range || typeof range !== "object") {
    return {
      salary_min: null,
      salary_max: null,
      salary_currency: null,
      salary_interval: null,
      salary_description:
        cleanText(job?.salaryDescriptionPlain ?? job?.salaryDescription ?? "") || null,
    };
  }

  return {
    salary_min: Number.isFinite(Number(range.min)) ? Number(range.min) : null,
    salary_max: Number.isFinite(Number(range.max)) ? Number(range.max) : null,
    salary_currency: range.currency ? String(range.currency).trim() : null,
    salary_interval: range.interval ? String(range.interval).trim() : null,
    salary_description:
      cleanText(job?.salaryDescriptionPlain ?? job?.salaryDescription ?? "") || null,
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
        return { status: 404, data: null };
      }

      if (response.status === 429 && attempt < retries) {
        const retryAfter = Number(response.headers.get("retry-after") ?? 0);
        await sleep(retryAfter > 0 ? retryAfter * 1000 : 2_000 * (attempt + 1));
        continue;
      }

      if (!response.ok) {
        throw new Error(`Lever respondeu ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return { status: response.status, data };
    } catch (error) {
      lastError = error;

      if (attempt < retries) {
        await sleep(900 * (attempt + 1));
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

function parseSiteLine(line) {
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

  let preferredRegion = null;

  if (/^eu\|/i.test(raw)) {
    preferredRegion = "eu";
    raw = raw.replace(/^eu\|/i, "");
  } else if (/^global\|/i.test(raw)) {
    preferredRegion = "global";
    raw = raw.replace(/^global\|/i, "");
  }

  raw = raw
    .replace(/^https?:\/\/jobs\.eu\.lever\.co\//i, "eu|")
    .replace(/^https?:\/\/jobs\.lever\.co\//i, "")
    .replace(/^https?:\/\/api\.eu\.lever\.co\/v0\/postings\//i, "eu|")
    .replace(/^https?:\/\/api\.lever\.co\/v0\/postings\//i, "");

  if (/^eu\|/i.test(raw)) {
    preferredRegion = "eu";
    raw = raw.replace(/^eu\|/i, "");
  }

  const slug = raw.split(/[/?#]/)[0].trim().toLowerCase();

  if (!slug) {
    return null;
  }

  return {
    slug,
    company: company ?? slug,
    preferredRegion,
  };
}

async function loadSites() {
  const sites = new Map();

  for (const [slug, company] of STARTER_SITES) {
    sites.set(slug, {
      slug,
      company,
      preferredRegion: null,
    });
  }

  try {
    const content = await fs.readFile(SITES_FILE, "utf8");

    for (const line of content.split(/\r?\n/)) {
      const parsed = parseSiteLine(line);

      if (parsed) {
        sites.set(parsed.slug, parsed);
      }
    }

    console.log(`Sites Lever carregados/mesclados: ${sites.size} (${SITES_FILE})`);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }

    const text = [
      "# Lever sites - Radar Vagas",
      "# Formato recomendado: slug=Nome da Empresa",
      "# Para forçar região EU: eu|slug=Nome da Empresa",
      "# URLs completas de jobs.lever.co também funcionam.",
      "",
      ...[...sites.values()]
        .sort((a, b) => a.slug.localeCompare(b.slug))
        .map((item) => `${item.slug}=${item.company}`),
      "",
    ].join("\n");

    await fs.writeFile(SITES_FILE, text, "utf8");
    console.log(`Arquivo criado: ${SITES_FILE}`);
  }

  return [...sites.values()].sort((a, b) => a.slug.localeCompare(b.slug));
}

async function loadFirstSeen() {
  try {
    const content = await fs.readFile(FIRST_SEEN_FILE, "utf8");
    const parsed = JSON.parse(content);

    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    if (error?.code === "ENOENT") {
      return {};
    }

    throw error;
  }
}

async function saveFirstSeen(cache) {
  await fs.writeFile(FIRST_SEEN_FILE, JSON.stringify(cache, null, 2), "utf8");
}

function baseUrl(region) {
  return region === "eu" ? EU_API_BASE : GLOBAL_API_BASE;
}

async function fetchSiteOnRegion(site, region) {
  const all = [];
  const seenIds = new Set();
  let skip = 0;
  let page = 1;

  while (true) {
    const url = new URL(`${baseUrl(region)}/${encodeURIComponent(site.slug)}`);

    url.searchParams.set("mode", "json");
    url.searchParams.set("skip", String(skip));
    url.searchParams.set("limit", String(PAGE_SIZE));

    const response = await fetchJson(url);

    if (response.status === 404) {
      return {
        found: false,
        region,
        jobs: [],
      };
    }

    if (!Array.isArray(response.data)) {
      throw new Error(`[${site.slug}] resposta inesperada na região ${region}`);
    }

    let newOnPage = 0;

    for (const job of response.data) {
      if (!job?.id) {
        continue;
      }

      const id = String(job.id);

      if (!seenIds.has(id)) {
        seenIds.add(id);
        all.push(job);
        newOnPage += 1;
      }
    }

    console.log(
      `[${site.slug}/${region}] página=${page} recebidas=${response.data.length} novas=${newOnPage} total=${all.length}`,
    );

    if (response.data.length < PAGE_SIZE) {
      break;
    }

    if (newOnPage === 0) {
      console.warn(`[${site.slug}/${region}] página repetida; encerrando para evitar loop.`);
      break;
    }

    skip += PAGE_SIZE;
    page += 1;
    await sleep(PAGE_DELAY_MS);
  }

  return {
    found: true,
    region,
    jobs: all,
  };
}

async function fetchSite(site) {
  const order =
    site.preferredRegion === "eu"
      ? ["eu", "global"]
      : site.preferredRegion === "global"
        ? ["global", "eu"]
        : ["global", "eu"];

  for (const region of order) {
    const result = await fetchSiteOnRegion(site, region);

    if (result.found) {
      return {
        ...site,
        region,
        jobs: result.jobs,
      };
    }
  }

  return null;
}

function mapJob(site, job, firstSeenCache, nowIso) {
  const description = buildDescription(job);
  const categories = job?.categories ?? {};
  const location = parseLocation(job);
  const workplaceType = normalizeWorkplaceType(job?.workplaceType, location.location_text);

  const externalId = `${site.slug}:${job.id}`;

  if (!firstSeenCache[externalId]) {
    firstSeenCache[externalId] = nowIso;
  }

  const createdAt = toIso(job?.createdAt);
  const firstSeenAt = firstSeenCache[externalId];

  const salary = normalizeSalary(job);

  return {
    source: "lever",
    external_id: externalId,
    title: String(job?.text ?? "").trim(),
    company: String(site.company ?? site.slug).trim(),
    category: inferCategory(job?.text, categories),
    seniority: inferSeniority(job?.text, categories?.level),
    workplace_type: workplaceType,
    contract_type: normalizeContractType(categories?.commitment, description),
    location_text: location.location_text,
    city: location.city,
    state: location.state,
    country: location.country,
    application_url: String(job?.hostedUrl ?? job?.applyUrl ?? "").trim(),
    apply_url: String(job?.applyUrl ?? "").trim() || null,
    description,
    application_deadline: null,
    skills: inferSkills(description),
    published_at: createdAt,
    first_seen_at: firstSeenAt,
    published_at_source: createdAt ? "createdAt" : "first_seen_fallback",
    lever_site: site.slug,
    lever_region: site.region,
    team: categories?.team ?? null,
    department: categories?.department ?? null,
    commitment: categories?.commitment ?? null,
    level: categories?.level ?? null,
    salary_min: salary.salary_min,
    salary_max: salary.salary_max,
    salary_currency: salary.salary_currency,
    salary_interval: salary.salary_interval,
    salary_description: salary.salary_description,
    active: true,
  };
}

function validateJob(job) {
  const errors = [];

  if (!job.external_id || job.external_id.endsWith(":undefined")) {
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
  console.log("Radar Vagas - Lever Dry Run");
  console.log(`Janela padrão: últimos ${WINDOW_DAYS} dias`);
  console.log("NENHUM dado será gravado no Supabase");
  console.log("====================================");

  const sites = await loadSites();
  const firstSeenCache = await loadFirstSeen();
  const nowIso = new Date().toISOString();

  let checked = 0;
  let validSites = 0;
  let invalidSites = 0;

  const siteResults = await mapPool(
    sites,
    async (site) => {
      try {
        const result = await fetchSite(site);

        checked += 1;

        if (result) {
          validSites += 1;
        } else {
          invalidSites += 1;
        }

        console.log(
          `Sites verificados: ${checked}/${sites.length} | válidos=${validSites} | inválidos=${invalidSites}`,
        );

        return result;
      } catch (error) {
        checked += 1;
        invalidSites += 1;

        console.warn(`[${site.slug}] falhou: ${error instanceof Error ? error.message : error}`);

        return null;
      }
    },
    SITE_CONCURRENCY,
  );

  const validSiteResults = siteResults.filter(Boolean);

  const mappedAll = [];

  for (const site of validSiteResults) {
    for (const job of site.jobs) {
      mappedAll.push(mapJob(site, job, firstSeenCache, nowIso));
    }
  }

  await saveFirstSeen(firstSeenCache);

  const byExternalId = new Map();

  for (const job of mappedAll) {
    byExternalId.set(job.external_id, job);
  }

  const uniqueAll = [...byExternalId.values()];

  const recentJobs = [];
  let recentByCreatedAt = 0;
  let recentByFirstSeen = 0;
  let oldByCreatedAt = 0;
  let oldByFirstSeen = 0;

  for (const job of uniqueAll) {
    if (job.published_at) {
      if (isWithinWindow(job.published_at, WINDOW_DAYS)) {
        recentJobs.push(job);
        recentByCreatedAt += 1;
      } else {
        oldByCreatedAt += 1;
      }

      continue;
    }

    if (isWithinWindow(job.first_seen_at, WINDOW_DAYS)) {
      recentJobs.push(job);
      recentByFirstSeen += 1;
    } else {
      oldByFirstSeen += 1;
    }
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

  console.log("\n====================================");
  console.log("RESUMO");
  console.log("====================================");
  console.log(`Sites configurados: ${sites.length}`);
  console.log(`Sites válidos: ${validSiteResults.length}`);
  console.log(`Sites inválidos: ${invalidSites}`);
  console.log(`Vagas públicas ativas encontradas: ${uniqueAll.length}`);
  console.log(`Recentes por createdAt: ${recentByCreatedAt}`);
  console.log(`Recentes por first_seen fallback: ${recentByFirstSeen}`);
  console.log(`Antigas por createdAt: ${oldByCreatedAt}`);
  console.log(`Antigas por first_seen fallback: ${oldByFirstSeen}`);
  console.log(`Vagas únicas na janela: ${recentJobs.length}`);
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

  console.log("\nBase da data:");
  console.table(summarize(validJobs, "published_at_source"));

  console.log("\nRegião Lever:");
  console.table(summarize(validJobs, "lever_region"));

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
  console.log(`Cache first_seen em: ${FIRST_SEEN_FILE}`);
  console.log("Nenhum dado foi gravado no Supabase.");
  console.log("====================================");
}

main().catch((error) => {
  console.error("Falha fatal no coletor:", error instanceof Error ? error.message : error);

  process.exitCode = 1;
});
