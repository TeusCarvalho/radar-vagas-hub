import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  WINDOW_DAYS,
  parseDate,
  isWithinWindow,
  standardizeJob,
  validateStandardJob,
  summarizeField,
} from "./collector-standard.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_FILE = path.join(__dirname, "infojobs-results.json");

const DETAIL_CACHE_FILE = path.join(process.cwd(), ".cache", "infojobs-detail-cache.json");

const DETAIL_CACHE_MAX_AGE_HOURS = Number(process.env.INFOJOBS_DETAIL_CACHE_MAX_AGE_HOURS ?? 168);

const ENABLE_DETAIL_FALLBACK = /^(1|true|yes)$/i.test(
  String(process.env.INFOJOBS_ENABLE_DETAIL_FALLBACK ?? "false"),
);

const MAX_DETAIL_REQUESTS = Math.max(0, Number(process.env.INFOJOBS_MAX_DETAIL_REQUESTS ?? 50));

const STATES = [
  ["AC", "Acre", 165],
  ["AL", "Alagoas", 166],
  ["AP", "Amapá", 167],
  ["AM", "Amazonas", 168],
  ["BA", "Bahia", 169],
  ["CE", "Ceará", 170],
  ["DF", "Distrito Federal", 171],
  ["ES", "Espírito Santo", 172],
  ["GO", "Goiás", 190],
  ["MA", "Maranhão", 173],
  ["MT", "Mato Grosso", 174],
  ["MS", "Mato Grosso do Sul", 175],
  ["MG", "Minas Gerais", 176],
  ["PA", "Pará", 177],
  ["PB", "Paraíba", 178],
  ["PR", "Paraná", 179],
  ["PE", "Pernambuco", 180],
  ["PI", "Piauí", 181],
  ["RJ", "Rio de Janeiro", 182],
  ["RN", "Rio Grande do Norte", 183],
  ["RS", "Rio Grande do Sul", 184],
  ["RO", "Rondônia", 185],
  ["RR", "Roraima", 186],
  ["SC", "Santa Catarina", 187],
  ["SP", "São Paulo", 64],
  ["SE", "Sergipe", 188],
  ["TO", "Tocantins", 189],
];

const BASE_URL = "https://www.infojobs.com.br/empregos.aspx?Antiguedad=3&campo=griddate&orden=desc";

const REQUEST_TIMEOUT_MS = Number(process.env.INFOJOBS_REQUEST_TIMEOUT_MS ?? 20_000);

const MAX_RETRIES = Number(process.env.INFOJOBS_MAX_RETRIES ?? 2);

const REQUEST_DELAY_MS = Number(process.env.INFOJOBS_REQUEST_DELAY_MS ?? 150);

const STATE_CONCURRENCY = Math.max(1, Number(process.env.INFOJOBS_STATE_CONCURRENCY ?? 2));

const DETAIL_CONCURRENCY = Math.max(1, Number(process.env.INFOJOBS_DETAIL_CONCURRENCY ?? 4));

// 0 = sem limite.
const MAX_PAGES_PER_STATE = Math.max(0, Number(process.env.INFOJOBS_MAX_PAGES_PER_STATE ?? 0));

// Exemplo:
// $env:INFOJOBS_UFS="DF,GO"
const ONLY_UFS = String(process.env.INFOJOBS_UFS ?? "")
  .split(",")
  .map((item) => item.trim().toUpperCase())
  .filter(Boolean);

const HEADERS = {
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
  "Cache-Control": "no-cache",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36",
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeHtml(value = "") {
  return String(value)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x2F;|&#47;/gi, "/")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

function stripHtml(value) {
  if (value === undefined || value === null) return null;

  const cleaned = decodeHtml(String(value))
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || null;
}

function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function listingUrl(provincia, page) {
  const url = new URL(BASE_URL);

  url.searchParams.set("provincia", String(provincia));

  if (page > 1) {
    // Confirmado no InfoJobs Brasil: P maiúsculo.
    url.searchParams.set("Page", String(page));
  }

  return url.toString();
}

async function fetchHtml(url, attempt = 0) {
  const controller = new AbortController();

  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: HEADERS,
      redirect: "follow",
      signal: controller.signal,
    });

    const html = await response.text();

    if ((response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES) {
      const waitMs = 1000 * 2 ** attempt;

      console.warn(`HTTP ${response.status}; retry em ${waitMs} ms: ${url}`);

      await sleep(waitMs);

      return fetchHtml(url, attempt + 1);
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}: ${url}`);
    }

    return html;
  } catch (error) {
    if (error?.name === "AbortError" && attempt < MAX_RETRIES) {
      const waitMs = 1000 * 2 ** attempt;

      console.warn(`Timeout; retry em ${waitMs} ms: ${url}`);

      await sleep(waitMs);

      return fetchHtml(url, attempt + 1);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function extractCardMarkers(html) {
  const markers = [];

  const divRegex = /<div\b[^>]*>/gi;

  for (const match of html.matchAll(divRegex)) {
    const tag = match[0];

    const vacancyMatch = tag.match(/\bid=["']vacancy(\d+)["']/i);

    const dataIdMatch = tag.match(/\bdata-id=["'](\d+)["']/i);

    const hrefMatch = tag.match(/\bdata-href=["']([^"']+)["']/i);

    if (!vacancyMatch || !dataIdMatch || !hrefMatch) {
      continue;
    }

    if (vacancyMatch[1] !== dataIdMatch[1]) {
      continue;
    }

    markers.push({
      id: vacancyMatch[1],
      href: decodeHtml(hrefMatch[1]),
      index: match.index ?? 0,
    });
  }

  return markers;
}

function extractCardBlocks(html) {
  const markers = extractCardMarkers(html);
  const cards = [];

  for (let index = 0; index < markers.length; index++) {
    const marker = markers[index];
    const next = markers[index + 1];

    const block = html.slice(marker.index, next ? next.index : html.length);

    cards.push({
      ...marker,
      block,
    });
  }

  // Fallback caso o wrapper principal mude.
  if (cards.length === 0) {
    const linkRegex = /href\s*=\s*["']([^"']*\/vaga-de-[^"']+__(\d+)\.aspx(?:\?[^"']*)?)["']/gi;

    const seen = new Set();

    for (const match of html.matchAll(linkRegex)) {
      const id = match[2];

      if (seen.has(id)) continue;
      seen.add(id);

      cards.push({
        id,
        href: decodeHtml(match[1]),
        index: match.index ?? 0,
        block: html.slice(
          Math.max(0, (match.index ?? 0) - 1500),
          Math.min(html.length, (match.index ?? 0) + 5000),
        ),
      });
    }
  }

  return cards;
}

function extractClassText(html, tagName, className) {
  const regex = new RegExp(
    `<${tagName}\\b[^>]*class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/${tagName}>`,
    "i",
  );

  const match = html.match(regex);

  return stripHtml(match?.[1]);
}

function cleanCompanyName(value) {
  const text = stripHtml(value);

  if (!text) return null;

  return (
    text
      .replace(/\s*Este selo indica que a empresa foi verificada pelo Infojobs\.[\s\S]*$/i, "")
      .replace(/\s+/g, " ")
      .trim() || null
  );
}

function extractCompany(card) {
  const companyLink =
    card.match(/<a\b[^>]*href=["'][^"']*\/empresa-[^"']+["'][^>]*>([\s\S]*?)<\/a>/i) ??
    card.match(
      /<a\b[^>]*href=["']https?:\/\/www\.infojobs\.com\.br\/empresa-[^"']+["'][^>]*>([\s\S]*?)<\/a>/i,
    );

  const company = cleanCompanyName(companyLink?.[1]);

  if (company) {
    return company;
  }

  if (/empresa confidencial/i.test(card)) {
    return "Empresa confidencial";
  }

  return null;
}

function extractSimpleTexts(card) {
  const values = [];

  const divRegex = /<div\b[^>]*class=["'][^"']*\btext-medium\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi;

  for (const match of card.matchAll(divRegex)) {
    const text = stripHtml(match[1]);

    if (text) values.push(text);
  }

  return [...new Set(values)];
}

function extractLocation(card) {
  const texts = extractSimpleTexts(card);

  for (const text of texts) {
    const cleaned = text.replace(/\s+\d+\s*Km de você\.?$/i, "").trim();

    if (/^Todo Brasil$/i.test(cleaned)) {
      return "Todo Brasil";
    }

    if (
      /^.+\s-\s(?:AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/i.test(
        cleaned,
      )
    ) {
      return cleaned;
    }
  }

  return null;
}

function extractIconContext(card, iconName) {
  const regex = new RegExp(
    `<svg\\b[^>]*class=["'][^"']*\\b${iconName}\\b[^"']*["'][^>]*>[\\s\\S]*?<\\/svg>([\\s\\S]{0,250}?)<\\/div>`,
    "i",
  );

  const match = card.match(regex);

  return match ? stripHtml(match[1]) : null;
}

function extractWorkplaceType(card) {
  const homeContext = extractIconContext(card, "icon-user-home");

  const buildingContext = extractIconContext(card, "icon-buildings");

  if (/home office/i.test(homeContext ?? "")) {
    return "Home office";
  }

  if (/h[ií]brid/i.test(homeContext ?? "") || /h[ií]brid/i.test(buildingContext ?? "")) {
    return "Híbrido";
  }

  if (/presencial/i.test(buildingContext ?? "")) {
    return "Presencial";
  }

  const texts = extractSimpleTexts(card);

  for (const text of texts) {
    if (/^Home office$/i.test(text)) {
      return "Home office";
    }

    if (/^H[ií]brido$/i.test(text)) {
      return "Híbrido";
    }

    if (/^Presencial$/i.test(text)) {
      return "Presencial";
    }
  }

  return null;
}

function extractSalaryText(card) {
  const texts = extractSimpleTexts(card);

  for (const text of texts) {
    if (
      /^R\$\s*/i.test(text) ||
      /^Sal[aá]rio a combinar$/i.test(text) ||
      /^A combinar$/i.test(text)
    ) {
      return text;
    }
  }

  return null;
}

function parseBrlNumber(value) {
  if (!value) return null;

  const cleaned = String(value)
    .replace(/[^\d.,-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const number = Number(cleaned);

  return Number.isFinite(number) ? number : null;
}

function parseSalary(text) {
  if (!text) {
    return {
      salary_min: null,
      salary_max: null,
      salary_currency: null,
      salary_interval: null,
      salary_description: null,
    };
  }

  const description = stripHtml(text);

  if (!description || /a combinar/i.test(description)) {
    return {
      salary_min: null,
      salary_max: null,
      salary_currency: null,
      salary_interval: null,
      salary_description: description,
    };
  }

  const values = [...description.matchAll(/R\$\s*([\d.]+(?:,\d{1,2})?)/gi)]
    .map((match) => parseBrlNumber(match[1]))
    .filter((value) => value !== null);

  let min = null;
  let max = null;

  if (values.length >= 2) {
    min = values[0];
    max = values[1];
  } else if (values.length === 1) {
    const value = values[0];

    if (/at[eé]\s+R\$/i.test(description)) {
      max = value;
    } else if (/a partir de\s+R\$/i.test(description)) {
      min = value;
    } else {
      min = value;
      max = value;
    }
  }

  let interval = null;

  if (/mensal|m[eê]s/i.test(description)) {
    interval = "MONTH";
  } else if (/anual|ano/i.test(description)) {
    interval = "YEAR";
  } else if (/hora/i.test(description)) {
    interval = "HOUR";
  }

  return {
    salary_min: min,
    salary_max: max,
    salary_currency: min !== null || max !== null ? "BRL" : null,
    salary_interval: interval,
    salary_description: description,
  };
}

function parseInfoJobsDate(value) {
  const text = String(value ?? "").trim();

  const match = text.match(/^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);

  if (!match) return null;

  const [, year, month, day, hour, minute, second] = match;

  // A página brasileira entrega este relógio sem timezone.
  // Fixamos BRT para evitar que o runner UTC altere a data/hora.
  const iso = `${year}-${month}-${day}` + `T${hour}:${minute}:${second}-03:00`;

  const parsed = new Date(iso);

  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function extractPublishedAt(card) {
  const match =
    card.match(/class=["'][^"']*\bjs_date\b[^"']*["'][^>]*\bdata-value=["']([^"']+)["']/i) ??
    card.match(/\bdata-value=["']([^"']+)["'][^>]*class=["'][^"']*\bjs_date\b[^"']*["']/i);

  return parseInfoJobsDate(decodeHtml(match?.[1] ?? ""));
}

function parseLocation(locationText) {
  if (!locationText) {
    return {
      city: null,
      state: null,
      country: "BR",
    };
  }

  if (/^Todo Brasil$/i.test(locationText)) {
    return {
      city: null,
      state: null,
      country: "BR",
    };
  }

  const match = locationText.match(/^(.+?)\s*-\s*([A-Z]{2})$/i);

  if (!match) {
    return {
      city: null,
      state: null,
      country: "BR",
    };
  }

  return {
    city: match[1].trim(),
    state: match[2].toUpperCase(),
    country: "BR",
  };
}

function mapCardToJob(card, shard) {
  let applicationUrl = null;

  try {
    applicationUrl = new URL(card.href, "https://www.infojobs.com.br").toString();
  } catch {
    // será invalidada/fallback depois
  }

  const title = extractClassText(card.block, "h2", "js_vacancyTitle") ?? "";

  const company = extractCompany(card.block);

  const locationText = extractLocation(card.block);
  const location = parseLocation(locationText);

  const sourceWorkplaceType = extractWorkplaceType(card.block);

  const publishedAt = extractPublishedAt(card.block);

  const salaryText = extractSalaryText(card.block);

  return {
    source: "infojobs",
    external_id: card.id,
    title,
    company,

    category_extra: null,
    source_seniority: null,

    source_workplace_type: sourceWorkplaceType,
    source_contract_type: null,

    location_text: locationText,
    city: location.city,
    state: location.state,
    country: location.country,

    ...parseSalary(salaryText),

    application_url: applicationUrl,

    description: null,
    skills: [],

    published_at: publishedAt,
    published_at_source: publishedAt ? "infojobs_listing_js_date" : null,

    application_deadline: null,

    first_seen_at: null,
    last_seen_at: null,
    active: true,

    // Campo auxiliar para diagnóstico. Não é usado como localização
    // canônica porque vagas Todo Brasil podem aparecer em várias UFs.
    source_scope_state: shard.uf,
  };
}

function completenessScore(job) {
  let score = 0;

  if (job.title) score += 10;
  if (job.company) score += 10;
  if (job.published_at) score += 10;
  if (job.application_url) score += 10;
  if (job.location_text) score += 5;
  if (job.source_workplace_type) score += 3;
  if (job.salary_description) score += 2;

  return score;
}

function mergeDuplicate(current, incoming) {
  if (!current) return incoming;

  const currentScore = completenessScore(current);
  const incomingScore = completenessScore(incoming);

  return incomingScore > currentScore ? incoming : current;
}

function needsRequiredFallback(job) {
  return (
    !job?.external_id || !job?.title || !job?.company || !job?.application_url || !job?.published_at
  );
}

function extractJsonLd(html) {
  const blocks = [];

  const regex = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  for (const match of html.matchAll(regex)) {
    const raw = match[1]?.trim();

    if (!raw) continue;

    try {
      blocks.push(JSON.parse(raw));
    } catch {
      // JSON-LD inválido: ignora.
    }
  }

  return blocks;
}

function flattenJsonLd(value, output = []) {
  if (value === undefined || value === null) {
    return output;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      flattenJsonLd(item, output);
    }

    return output;
  }

  if (typeof value !== "object") {
    return output;
  }

  output.push(value);

  if (value["@graph"]) {
    flattenJsonLd(value["@graph"], output);
  }

  return output;
}

function findJobPosting(html) {
  const all = [];

  for (const block of extractJsonLd(html)) {
    flattenJsonLd(block, all);
  }

  return (
    all.find((item) => {
      const type = item?.["@type"];

      if (Array.isArray(type)) {
        return type.includes("JobPosting");
      }

      return type === "JobPosting";
    }) ?? null
  );
}

function fillFromDetail(job, html) {
  const posting = findJobPosting(html);

  const result = {
    ...job,
  };

  if (posting) {
    if (!result.title) {
      result.title = stripHtml(posting.title) ?? result.title;
    }

    if (!result.company) {
      result.company = cleanCompanyName(posting?.hiringOrganization?.name) ?? result.company;
    }

    if (!result.published_at && posting.datePosted) {
      const parsed = parseDate(posting.datePosted);

      if (parsed) {
        result.published_at = parsed.toISOString();

        result.published_at_source = "infojobs_jobposting_datePosted";
      }
    }
  }

  // Fallback HTML para páginas sem JSON-LD.
  if (!result.title) {
    result.title = extractClassText(html, "h2", "js_vacancyHeaderTitle") ?? result.title;
  }

  if (!result.company) {
    result.company = extractCompany(html) ?? result.company;
  }

  return result;
}

async function readDetailCache() {
  try {
    const raw = await fs.readFile(DETAIL_CACHE_FILE, "utf8");

    const parsed = JSON.parse(raw);

    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    if (error?.code === "ENOENT") {
      return {};
    }

    console.warn(
      `Não foi possível ler cache InfoJobs: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );

    return {};
  }
}

function detailCacheIsFresh(entry) {
  const fetchedAt = parseDate(entry?.fetched_at);

  if (!fetchedAt) return false;

  const maxAgeMs = DETAIL_CACHE_MAX_AGE_HOURS * 60 * 60 * 1000;

  return Date.now() - fetchedAt.getTime() <= maxAgeMs;
}

async function writeDetailCache(cache) {
  await fs.mkdir(path.dirname(DETAIL_CACHE_FILE), { recursive: true });

  await fs.writeFile(DETAIL_CACHE_FILE, JSON.stringify(cache, null, 2), "utf8");
}

function applyCachedDetail(job, entry) {
  if (!entry || !detailCacheIsFresh(entry)) {
    return job;
  }

  const cached = entry.job;

  if (!cached) return job;

  let company = job.company ?? cached.company ?? null;

  // Se o detalhe já foi consultado e mesmo assim a fonte
  // não informou empresa, não repetimos a mesma requisição
  // em todas as execuções. O placeholder é explícito e não
  // inventa um nome de empresa.
  if (
    !company &&
    (entry.company_checked === true || Object.prototype.hasOwnProperty.call(cached, "company"))
  ) {
    company = "Empresa não informada";
  }

  return {
    ...job,
    company,
    title: job.title || cached.title || "",
    published_at: job.published_at ?? cached.published_at ?? null,
    published_at_source: job.published_at_source ?? cached.published_at_source ?? null,
  };
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const output = new Array(items.length);

  let cursor = 0;

  async function worker() {
    while (true) {
      const index = cursor++;

      if (index >= items.length) return;

      try {
        output[index] = await mapper(items[index], index);
      } catch (error) {
        output[index] = {
          __error: error instanceof Error ? error.message : String(error),
          __item: items[index],
        };
      }
    }
  }

  const count = Math.max(1, Math.min(concurrency, items.length || 1));

  await Promise.all(Array.from({ length: count }, () => worker()));

  return output;
}

async function collectState(shard) {
  const jobs = new Map();

  let page = 1;
  let previousSignature = null;
  let pagesFetched = 0;

  while (true) {
    if (MAX_PAGES_PER_STATE > 0 && page > MAX_PAGES_PER_STATE) {
      break;
    }

    const html = await fetchHtml(listingUrl(shard.provincia, page));

    pagesFetched += 1;

    const cards = extractCardBlocks(html);

    if (cards.length === 0) {
      break;
    }

    const signature = cards.map((card) => card.id).join(",");

    if (signature === previousSignature) {
      break;
    }

    previousSignature = signature;

    let newOnPage = 0;

    for (const card of cards) {
      const raw = mapCardToJob(card, shard);

      const current = jobs.get(raw.external_id);
      const merged = mergeDuplicate(current, raw);

      if (!current) newOnPage += 1;

      jobs.set(raw.external_id, merged);
    }

    if (newOnPage === 0) {
      break;
    }

    page += 1;

    if (REQUEST_DELAY_MS > 0) {
      await sleep(REQUEST_DELAY_MS);
    }
  }

  return {
    shard,
    pagesFetched,
    jobs,
  };
}

function selectedStates() {
  if (ONLY_UFS.length === 0) {
    return STATES.map(([uf, name, provincia]) => ({
      uf,
      name,
      provincia,
    }));
  }

  const allowed = new Set(ONLY_UFS);

  return STATES.filter(([uf]) => allowed.has(uf)).map(([uf, name, provincia]) => ({
    uf,
    name,
    provincia,
  }));
}

async function main() {
  const states = selectedStates();

  if (states.length === 0) {
    throw new Error(`INFOJOBS_UFS não corresponde a nenhuma UF válida: ${ONLY_UFS.join(", ")}`);
  }

  console.log("==============================================");
  console.log("Radar Vagas - INFOJOBS OTIMIZADO");
  console.log(`Janela: últimos ${WINDOW_DAYS} dias`);
  console.log("Fonte: cards públicos do InfoJobs Brasil");
  console.log(`UFs: ${states.map((state) => state.uf).join(", ")}`);
  console.log(`Concorrência de estados: ${STATE_CONCURRENCY}`);

  if (MAX_PAGES_PER_STATE > 0) {
    console.log(`MODO DE TESTE: máximo ${MAX_PAGES_PER_STATE} página(s) por UF`);
  } else {
    console.log("Paginação: completa por UF");
  }

  console.log(
    ENABLE_DETAIL_FALLBACK
      ? `Detalhes individuais: habilitados, máximo ${MAX_DETAIL_REQUESTS}`
      : "Detalhes individuais: DESABILITADOS (listing-first)",
  );
  console.log("NENHUM dado será gravado no Supabase");
  console.log("==============================================\n");

  const stateResults = await mapWithConcurrency(states, STATE_CONCURRENCY, async (shard) => {
    const result = await collectState(shard);

    console.log(`${shard.uf}: ${result.jobs.size} IDs | ${result.pagesFetched} página(s)`);

    return result;
  });

  const stateErrors = [];
  const union = new Map();
  const seenStates = new Map();

  let totalPages = 0;
  let totalCardsUniquePerState = 0;

  for (const result of stateResults) {
    if (!result) continue;

    if (result.__error) {
      stateErrors.push({
        shard: result.__item,
        error: result.__error,
      });
      continue;
    }

    totalPages += result.pagesFetched;
    totalCardsUniquePerState += result.jobs.size;

    for (const [id, job] of result.jobs) {
      const current = union.get(id);

      union.set(id, mergeDuplicate(current, job));

      if (!seenStates.has(id)) {
        seenStates.set(id, new Set());
      }

      seenStates.get(id).add(result.shard.uf);
    }
  }

  if (stateErrors.length) {
    console.warn(`\nATENÇÃO: ${stateErrors.length} shard(s) com erro.`);
  }

  const crossStateDuplicates = [...seenStates.values()].filter(
    (statesSet) => statesSet.size > 1,
  ).length;

  console.log("\n----------------------------------------------");
  console.log(`Páginas de listagem: ${totalPages}`);
  console.log(`IDs somados por UF: ${totalCardsUniquePerState}`);
  console.log(`IDs únicos no union: ${union.size}`);
  console.log(`IDs vistos em >1 UF: ${crossStateDuplicates}`);

  let outsideWindow = 0;
  let withoutDate = 0;

  const withinWindow = [];

  for (const job of union.values()) {
    if (!job.published_at) {
      withoutDate += 1;
      withinWindow.push(job);
      continue;
    }

    if (!isWithinWindow(job.published_at, WINDOW_DAYS)) {
      outsideWindow += 1;
      continue;
    }

    withinWindow.push(job);
  }

  const detailCache = await readDetailCache();

  const enrichedById = new Map();
  let cacheHits = 0;
  let companyPlaceholders = 0;

  for (const job of withinWindow) {
    const cachedJob = applyCachedDetail(job, detailCache[job.external_id]);

    if (!job.company && cachedJob.company && cachedJob.company !== "Empresa não informada") {
      cacheHits += 1;
    }

    enrichedById.set(job.external_id, cachedJob);
  }

  const missingRequiredBeforePlaceholder = [...enrichedById.values()].filter(needsRequiredFallback);

  const detailCandidates = ENABLE_DETAIL_FALLBACK
    ? missingRequiredBeforePlaceholder
        .filter((job) => !job.company && job.title && job.application_url && job.published_at)
        .slice(0, MAX_DETAIL_REQUESTS)
    : [];

  console.log(`Fora da janela exata: ${outsideWindow}`);
  console.log(`Sem data no card: ${withoutDate}`);
  console.log(`Empresa/dados recuperados do cache: ${cacheHits}`);
  console.log(
    `Campos obrigatórios faltando no listing/cache: ${missingRequiredBeforePlaceholder.length}`,
  );
  console.log(`Detalhes que serão consultados: ${detailCandidates.length}`);

  const detailResults = await mapWithConcurrency(
    detailCandidates,
    Math.min(DETAIL_CONCURRENCY, 2),
    async (job, index) => {
      const html = await fetchHtml(job.application_url);

      const enriched = fillFromDetail(job, html);

      detailCache[job.external_id] = {
        fetched_at: new Date().toISOString(),
        company_checked: true,
        job: {
          external_id: enriched.external_id,
          title: enriched.title,
          company: enriched.company ?? null,
          published_at: enriched.published_at,
          published_at_source: enriched.published_at_source,
        },
      };

      if (!enriched.company) {
        enriched.company = "Empresa não informada";
      }

      if (index === 0 || (index + 1) % 10 === 0 || index + 1 === detailCandidates.length) {
        console.log(`Fallback detalhes: ${index + 1}/${detailCandidates.length}`);
      }

      if (REQUEST_DELAY_MS > 0) {
        await sleep(Math.max(REQUEST_DELAY_MS, 500));
      }

      return enriched;
    },
  );

  const detailErrors = [];

  for (const result of detailResults) {
    if (!result) continue;

    if (result.__error) {
      detailErrors.push({
        id: result.__item?.external_id ?? null,
        error: result.__error,
      });

      continue;
    }

    enrichedById.set(result.external_id, result);
  }

  // Regra de produção:
  // se o card/cache não fornece empresa, mantemos um placeholder explícito.
  // Não inventamos nome e não descartamos a vaga por isso.
  for (const [id, job] of enrichedById) {
    if (!job.company) {
      enrichedById.set(id, {
        ...job,
        company: "Empresa não informada",
      });

      companyPlaceholders += 1;
    }
  }

  if (detailCandidates.length > 0) {
    await writeDetailCache(detailCache);
  }

  const validJobs = [];
  const invalidJobs = [];

  for (const raw of enrichedById.values()) {
    if (!raw.published_at || !isWithinWindow(raw.published_at, WINDOW_DAYS)) {
      continue;
    }

    const standardized = standardizeJob(raw);

    const errors = validateStandardJob(standardized);

    if (errors.length) {
      invalidJobs.push({
        external_id: standardized.external_id,
        title: standardized.title,
        errors,
      });
    } else {
      validJobs.push(standardized);
    }
  }

  const expectedWithinWindow = union.size - outsideWindow - withoutDate;

  const finalCountDifference = expectedWithinWindow - validJobs.length;

  validJobs.sort((a, b) => {
    const aTime = parseDate(a.published_at)?.getTime() ?? 0;

    const bTime = parseDate(b.published_at)?.getTime() ?? 0;

    return bTime - aTime;
  });

  await fs.writeFile(OUTPUT_FILE, JSON.stringify(validJobs, null, 2), "utf8");

  console.log("\n==============================================");
  console.log("RESUMO INFOJOBS OTIMIZADO");
  console.log("==============================================");
  console.log(`UFs processadas:               ${states.length}`);
  console.log(`Páginas de listagem:           ${totalPages}`);
  console.log(`IDs somados por UF:            ${totalCardsUniquePerState}`);
  console.log(`IDs únicos antes da janela:    ${union.size}`);
  console.log(`Duplicados entre UFs:          ${crossStateDuplicates}`);
  console.log(`Fora dos ${WINDOW_DAYS} dias exatos:          ${outsideWindow}`);
  console.log(`Cache de detalhe aproveitado:  ${cacheHits}`);
  console.log(`Detalhes consultados:          ${detailCandidates.length}`);
  console.log(`Erros de detalhe:              ${detailErrors.length}`);
  console.log(`Placeholder de empresa:        ${companyPlaceholders}`);
  console.log(`Inválidas no schema padrão:    ${invalidJobs.length}`);
  console.log(`Vagas válidas finais:          ${validJobs.length}`);
  console.log(`Esperadas dentro da janela:    ${expectedWithinWindow}`);
  console.log(`Diferença de contagem:         ${finalCountDifference}`);

  const companyNotInformed = validJobs.filter(
    (job) => job.company === "Empresa não informada",
  ).length;

  console.log(`Empresa não informada:         ${companyNotInformed}`);

  console.log("\nModalidade:");
  console.table(summarizeField(validJobs, "workplace_type"));

  console.log("Senioridade:");
  console.table(summarizeField(validJobs, "seniority"));

  console.log("Categoria:");
  console.table(summarizeField(validJobs, "category"));

  console.log("Contrato:");
  console.table(summarizeField(validJobs, "contract_type"));

  if (invalidJobs.length) {
    console.log("\nPrimeiras vagas inválidas:");

    console.table(invalidJobs.slice(0, 10));
  }

  if (detailErrors.length) {
    console.log("\nPrimeiros erros de detalhe:");

    console.table(detailErrors.slice(0, 10));
  }

  if (stateErrors.length) {
    console.log("\nErros de shard:");

    console.table(
      stateErrors.map((item) => ({
        uf: item.shard?.uf ?? "",
        error: item.error,
      })),
    );
  }

  console.log(`\nJSON: ${OUTPUT_FILE}`);

  // Um shard com erro produz um catálogo parcial, mesmo que as demais UFs tenham
  // retornado vagas. Sinalizar falha impede sincronização incompleta em produção.
  // O JSON de diagnóstico permanece disponível no workspace desta execução.
  if (stateErrors.length > 0) {
    console.error(
      `Coleta InfoJobs incompleta: ${stateErrors.length} UF(s) falharam. Não sincronizar esta carga.`,
    );
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(
    "Falha fatal no coletor InfoJobs:",
    error instanceof Error ? error.message : String(error),
  );

  process.exitCode = 1;
});
