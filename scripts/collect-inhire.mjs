import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import {
  WINDOW_DAYS,
  parseDate,
  isWithinWindow,
  standardizeJob,
  validateStandardJob,
} from "./collector-standard.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_BASE = "https://api.inhire.app/job-posts/public/pages";
const BOOTSTRAP_TENANTS_URL =
  "https://raw.githubusercontent.com/vonrondow/busca-vagas-gupy-inhire/main/busca_vagas/inhire_all_tenants.json";

const TENANTS_CACHE = path.join(__dirname, "inhire-tenants.json");
const OUTPUT_FILE = path.join(__dirname, "inhire-results.json");
const PUBLISHED_CACHE_FILE = path.join(process.cwd(), ".cache", "inhire-published-cache.json");

const TENANT_CONCURRENCY = 10;
const DETAIL_CONCURRENCY = 8;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;
const PUBLISHED_CACHE_VERSION = 1;
const PUBLISHED_CACHE_MAX_AGE_HOURS = Number(process.env.INHIRE_CACHE_MAX_AGE_HOURS ?? 168);

const INHIRE_HEADERS = {
  Accept: "application/json",
  "Content-Type": "application/json",
  "X-Inhire-Client": "web-inhire",
  "User-Agent": "Radar-Vagas/1.0",
};

const BRAZIL_STATES = new Set([
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
]);

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

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function firstString(...values) {
  const value = firstValue(...values);

  if (value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    return value.trim() || null;
  }

  return null;
}

function slugify(value = "") {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stripHtml(value) {
  if (!value) {
    return null;
  }

  return String(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, " ")
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
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function objectText(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return stripHtml(value);
  }

  if (Array.isArray(value)) {
    const text = value
      .map((item) => objectText(item))
      .filter(Boolean)
      .join("\n");

    return text || null;
  }

  if (typeof value === "object") {
    const preferredKeys = [
      "description",
      "content",
      "text",
      "value",
      "html",
      "requirements",
      "responsibilities",
      "activities",
      "additionalInformation",
    ];

    const chunks = [];

    for (const key of preferredKeys) {
      if (value[key]) {
        const piece = objectText(value[key]);

        if (piece) {
          chunks.push(piece);
        }
      }
    }

    return [...new Set(chunks)].join("\n\n") || null;
  }

  return null;
}

function buildDescription(detail, summary) {
  const candidates = [
    detail?.description,
    detail?.jobDescription,
    detail?.descriptionHtml,
    detail?.content,
    detail?.activities,
    detail?.responsibilities,
    detail?.requirements,
    detail?.additionalInformation,
    detail?.jobRequirements,
    detail?.jobActivities,
    summary?.description,
  ];

  const parts = candidates.map((value) => objectText(value)).filter(Boolean);

  return [...new Set(parts)].join("\n\n") || null;
}

function normalizeWorkplaceType(value) {
  const text = normalizeText(value);

  if (text.includes("remote") || text.includes("remoto")) {
    return "remote";
  }

  if (text.includes("hybrid") || text.includes("hibrido")) {
    return "hybrid";
  }

  if (text.includes("on-site") || text.includes("onsite") || text.includes("presencial")) {
    return "onsite";
  }

  return "unknown";
}

function inferSeniority(title) {
  const text = normalizeText(title);

  if (/\bestagio\b/.test(text) || /\bestagiario\b/.test(text) || /\bintern(ship)?\b/.test(text)) {
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

  if (/\bespecialista\b/.test(text) || /\bspecialist\b/.test(text) || /\blead\b/.test(text)) {
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

  return "Dados e Analytics";
}

function matchesTargetRole(title) {
  const text = normalizeText(title);

  return (
    text.includes("analista de dados") ||
    text.includes("data analyst") ||
    text.includes("analista de bi") ||
    text.includes("business intelligence")
  );
}

function normalizeContractType(rawType, description = "") {
  const type = normalizeText(rawType);
  const text = normalizeText(`${rawType ?? ""} ${description ?? ""}`);

  if (type.includes("intern") || type.includes("estagio") || /\bestagio\b/.test(text)) {
    return "estagio";
  }

  if (type.includes("temporary") || type.includes("temporar") || /\btemporari[oa]\b/.test(text)) {
    return "temporario";
  }

  if (/\bclt\b/.test(text) || text.includes("consolidacao das leis do trabalho")) {
    return "clt";
  }

  if (/\bpj\b/.test(text) || text.includes("pessoa juridica")) {
    return "pj";
  }

  return "nao_informado";
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

function locationToString(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value.trim() || null;
  }

  if (Array.isArray(value)) {
    const items = value.map(locationToString).filter(Boolean);
    return items.join(" / ") || null;
  }

  if (typeof value === "object") {
    const city = firstString(value.city, value.name, value.locality);
    const state = firstString(value.state, value.uf, value.region, value.stateCode);
    const country = firstString(value.country, value.countryName);

    return [city, state, country].filter(Boolean).join(", ") || null;
  }

  return null;
}

function parseBrazilLocation(locationText, workplaceType) {
  const text = String(locationText ?? "").trim();

  if (!text) {
    return {
      location_text: workplaceType === "remote" ? "Remoto - Brasil" : "Local não informado",
      city: null,
      state: null,
      country: "Brasil",
    };
  }

  const normalized = normalizeText(text);
  const country = normalized.includes("portugal")
    ? "Portugal"
    : normalized.includes("united states") || normalized.includes("estados unidos")
      ? "Estados Unidos"
      : normalized.includes("argentina")
        ? "Argentina"
        : normalized.includes("mexico")
          ? "México"
          : "Brasil";

  let state = null;
  let city = null;

  const stateMatch = text
    .toUpperCase()
    .match(
      /(?:,|\s|-)\s*(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/,
    );

  if (stateMatch && BRAZIL_STATES.has(stateMatch[1])) {
    state = stateMatch[1];

    const beforeState = text.slice(0, stateMatch.index).trim();
    city =
      beforeState
        .replace(/\b(remoto|remote|hibrido|híbrido|presencial)\b/gi, "")
        .replace(/[,\-|/]+$/g, "")
        .trim() || null;
  }

  return {
    location_text: text,
    city,
    state,
    country,
  };
}

function makePublishedCacheKey(slug, jobId) {
  const normalizedSlug = String(slug ?? "")
    .trim()
    .toLowerCase();
  const normalizedJobId = String(jobId ?? "").trim();

  return normalizedSlug && normalizedJobId ? `${normalizedSlug}:${normalizedJobId}` : null;
}

function makeSummaryFingerprint(summary) {
  if (!summary || typeof summary !== "object") {
    return null;
  }

  return createHash("sha1").update(JSON.stringify(summary)).digest("hex");
}

function isCacheEntryFresh(entry) {
  if (!entry?.checked_at) {
    return false;
  }

  const checkedAt = parseDate(entry.checked_at);

  if (!checkedAt) {
    return false;
  }

  const maxAgeMs = PUBLISHED_CACHE_MAX_AGE_HOURS * 60 * 60 * 1000;
  return Date.now() - checkedAt.getTime() <= maxAgeMs;
}

async function loadPublishedCache() {
  try {
    const raw = JSON.parse(await fs.readFile(PUBLISHED_CACHE_FILE, "utf8"));
    const items = raw?.version === PUBLISHED_CACHE_VERSION ? raw.items : raw;

    if (!items || typeof items !== "object" || Array.isArray(items)) {
      return new Map();
    }

    const cache = new Map();

    for (const [key, value] of Object.entries(items)) {
      const publishedAt = firstString(typeof value === "string" ? value : value?.published_at);

      if (!publishedAt || !parseDate(publishedAt)) {
        continue;
      }

      cache.set(key, {
        published_at: publishedAt,
        summary_fingerprint:
          typeof value === "object" ? firstString(value?.summary_fingerprint) : null,
        checked_at: typeof value === "object" ? firstString(value?.checked_at) : null,
      });
    }

    console.log(`Cache de published_at carregado: ${cache.size} entradas`);
    return cache;
  } catch {
    console.log("Cache de published_at não encontrado. Esta execução fará o aquecimento do cache.");
    return new Map();
  }
}

async function savePublishedCache(cache, activeKeys) {
  const items = {};

  for (const key of activeKeys) {
    const entry = cache.get(key);

    if (!entry?.published_at || !parseDate(entry.published_at)) {
      continue;
    }

    items[key] = entry;
  }

  await fs.mkdir(path.dirname(PUBLISHED_CACHE_FILE), { recursive: true });
  await fs.writeFile(
    PUBLISHED_CACHE_FILE,
    JSON.stringify(
      {
        version: PUBLISHED_CACHE_VERSION,
        generated_at: new Date().toISOString(),
        items,
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(`Cache de published_at salvo: ${Object.keys(items).length} entradas`);
}

function makeHeaders(slug) {
  return {
    ...INHIRE_HEADERS,
    "X-Tenant": slug,
  };
}

async function fetchJson(url, headers, retries = MAX_RETRIES) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = new Error(`${response.status} ${response.statusText} em ${url}`);
        error.status = response.status;

        if (
          response.status >= 400 &&
          response.status < 500 &&
          response.status !== 408 &&
          response.status !== 429
        ) {
          throw error;
        }

        lastError = error;
      } else {
        return await response.json();
      }
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }

    if (attempt < retries) {
      await sleep(400 * (attempt + 1));
    }
  }

  throw lastError ?? new Error(`Falha ao consultar ${url}`);
}

async function loadTenants() {
  try {
    const local = JSON.parse(await fs.readFile(TENANTS_CACHE, "utf8"));

    const tenants = local
      .map((item) =>
        typeof item === "string"
          ? { slug: item }
          : { slug: item?.slug, tenantName: item?.tenantName ?? null },
      )
      .filter((item) => item.slug);

    if (tenants.length > 0) {
      console.log(`Tenants carregados do cache local: ${tenants.length} (${TENANTS_CACHE})`);
      return tenants;
    }
  } catch {
    // Primeira execução: baixa somente a lista-base pública e cria cache local.
  }

  console.log("Cache de tenants não encontrado. Baixando lista-base pública...");

  const bootstrap = await fetchJson(
    BOOTSTRAP_TENANTS_URL,
    {
      Accept: "application/json",
      "User-Agent": "Radar-Vagas/1.0",
    },
    1,
  );

  if (!Array.isArray(bootstrap)) {
    throw new Error("A lista-base de tenants retornou um formato inesperado.");
  }

  const tenants = bootstrap
    .map((item) => ({
      slug: String(item?.slug ?? "")
        .trim()
        .toLowerCase(),
      tenantName: firstString(item?.tenantName),
    }))
    .filter((item) => item.slug);

  await fs.writeFile(TENANTS_CACHE, JSON.stringify(tenants, null, 2), "utf8");

  console.log(`Cache criado com ${tenants.length} tenants.`);
  return tenants;
}

async function fetchTenant(slug) {
  const data = await fetchJson(API_BASE, makeHeaders(slug));

  if (Array.isArray(data)) {
    return null;
  }

  if (!data || typeof data !== "object") {
    return null;
  }

  return {
    slug,
    tenantName: firstString(data.tenantName) ?? slug,
    jobs: Array.isArray(data.jobsPage) ? data.jobsPage : [],
  };
}

async function fetchJobDetail(slug, jobId) {
  if (!jobId) {
    return null;
  }

  try {
    const data = await fetchJson(`${API_BASE}/${encodeURIComponent(jobId)}`, makeHeaders(slug), 1);

    return data && typeof data === "object" && !Array.isArray(data) ? data : null;
  } catch {
    // O resumo do /pages ainda é suficiente para manter a vaga no radar.
    return null;
  }
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

  await Promise.all(
    Array.from({ length: Math.min(concurrency, Math.max(items.length, 1)) }, () => run()),
  );

  return results;
}

function isPublished(job) {
  const status = normalizeText(job?.status);

  return !status || status === "published" || status === "publicado";
}

function mapInHireJob({ tenant, summary, detail, cachedPublishedAt = null }) {
  const title =
    firstString(
      detail?.displayName,
      detail?.title,
      detail?.name,
      summary?.displayName,
      summary?.title,
      summary?.name,
    ) ?? "";

  const description = buildDescription(detail, summary);

  const workplaceRaw = firstValue(
    detail?.workplaceType,
    detail?.workplace_type,
    detail?.workModel,
    summary?.workplaceType,
    summary?.workplace_type,
  );

  const workplaceType = normalizeWorkplaceType(workplaceRaw);

  const locationRaw = firstValue(
    detail?.location,
    detail?.locations,
    detail?.jobLocation,
    summary?.location,
    summary?.locations,
  );

  const location = parseBrazilLocation(locationToString(locationRaw), workplaceType);

  const jobId = String(
    firstValue(detail?.jobId, detail?.id, summary?.jobId, summary?.id) ?? "",
  ).trim();

  const contractRaw = firstValue(
    detail?.contractType,
    detail?.employmentType,
    detail?.hiringType,
    detail?.jobType,
    summary?.contractType,
    summary?.employmentType,
    summary?.hiringType,
  );

  const skills = normalizeSkills(
    firstValue(detail?.skills, detail?.requiredSkills, detail?.competencies, summary?.skills),
  );

  const applicationDeadline =
    firstString(
      detail?.applicationDeadline,
      detail?.deadline,
      detail?.closingDate,
      detail?.expiresAt,
      summary?.applicationDeadline,
      summary?.deadline,
    ) ?? null;

  const publishedAtFromApi =
    firstString(
      detail?.publishedAt,
      detail?.publishedDate,
      detail?.publicationDate,
      detail?.createdAt,
      summary?.publishedAt,
      summary?.publishedDate,
      summary?.publicationDate,
      summary?.createdAt,
    ) ?? null;

  const publishedAt = publishedAtFromApi ?? cachedPublishedAt ?? null;

  return {
    source: "inhire",
    external_id: jobId,
    title,
    company: tenant.tenantName,
    category: "Outros",
    seniority: inferSeniority(title),
    workplace_type: workplaceType,
    source_workplace_type: workplaceRaw ?? null,
    contract_type: normalizeContractType(contractRaw, description),
    source_contract_type: contractRaw ?? null,
    location_text: location.location_text,
    city: location.city,
    state: location.state,
    country: location.country,
    application_url: jobId
      ? `https://${tenant.slug}.inhire.app/vagas/${jobId}/${slugify(title)}`
      : "",
    description,
    application_deadline: applicationDeadline,
    skills,
    salary_min: null,
    salary_max: null,
    salary_currency: null,
    salary_interval: null,
    salary_description: null,
    published_at: publishedAt,
    published_at_source: publishedAtFromApi
      ? "inhire_publication_or_created"
      : publishedAt
        ? "inhire_published_cache"
        : null,
    first_seen_at: null,
    last_seen_at: null,
    active: true,
  };
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

function summarize(validJobs) {
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

  return {
    workplaceSummary,
    senioritySummary,
    categorySummary,
    contractSummary,
  };
}

async function main() {
  console.log("====================================");
  console.log("Radar Vagas - InHire PADRÃO");
  console.log("TODOS os tipos de vaga pública");
  console.log(`Janela: últimos ${WINDOW_DAYS} dias`);
  console.log("Saída no schema padrão Radar Vagas");
  console.log("NENHUM dado será gravado no Supabase");
  console.log("====================================");

  const tenantSeeds = await loadTenants();
  const publishedCache = await loadPublishedCache();
  const activeCacheKeys = new Set();

  let checked = 0;
  let tenantErrors = 0;

  const tenantResults = await mapPool(
    tenantSeeds,
    async ({ slug }) => {
      try {
        const tenant = await fetchTenant(slug);

        checked += 1;

        if (checked % 25 === 0 || checked === tenantSeeds.length) {
          console.log(`Tenants verificados: ${checked}/${tenantSeeds.length}`);
        }

        return tenant;
      } catch (error) {
        checked += 1;
        tenantErrors += 1;

        console.error(`[tenant:${slug}] ${error instanceof Error ? error.message : error}`);

        return null;
      }
    },
    TENANT_CONCURRENCY,
  );

  const tenants = tenantResults.filter(Boolean);

  const detailCandidates = [];
  let publicIndexCount = 0;
  let outsideWindowBySummary = 0;
  let outsideWindowByCache = 0;
  let withoutDateInSummary = 0;
  let cacheHits = 0;
  let cacheMisses = 0;
  let cacheExpiredOrChanged = 0;

  for (const tenant of tenants) {
    for (const job of tenant.jobs) {
      if (!isPublished(job)) {
        continue;
      }

      const title = firstString(job?.displayName, job?.title, job?.name);

      if (!title) {
        continue;
      }

      publicIndexCount += 1;

      const jobId = String(firstValue(job?.jobId, job?.id) ?? "").trim();
      const cacheKey = makePublishedCacheKey(tenant.slug, jobId);
      const summaryFingerprint = makeSummaryFingerprint(job);

      if (cacheKey) {
        activeCacheKeys.add(cacheKey);
      }

      const summaryPublishedAt = firstString(
        job?.publishedAt,
        job?.publishedDate,
        job?.publicationDate,
        job?.createdAt,
      );

      let cachedPublishedAt = null;

      if (summaryPublishedAt && parseDate(summaryPublishedAt)) {
        if (cacheKey) {
          publishedCache.set(cacheKey, {
            published_at: summaryPublishedAt,
            summary_fingerprint: summaryFingerprint,
            checked_at: new Date().toISOString(),
          });
        }

        if (!isWithinWindow(summaryPublishedAt, WINDOW_DAYS)) {
          outsideWindowBySummary += 1;
          continue;
        }
      } else {
        withoutDateInSummary += 1;

        const cachedEntry = cacheKey ? publishedCache.get(cacheKey) : null;
        const sameSummary =
          cachedEntry?.summary_fingerprint &&
          summaryFingerprint &&
          cachedEntry.summary_fingerprint === summaryFingerprint;

        if (cachedEntry?.published_at && sameSummary && isCacheEntryFresh(cachedEntry)) {
          cacheHits += 1;
          cachedPublishedAt = cachedEntry.published_at;

          if (!isWithinWindow(cachedPublishedAt, WINDOW_DAYS)) {
            outsideWindowByCache += 1;
            continue;
          }
        } else {
          cacheMisses += 1;

          if (cachedEntry) {
            cacheExpiredOrChanged += 1;
          }
        }
      }

      detailCandidates.push({
        tenant,
        summary: job,
        cacheKey,
        summaryFingerprint,
        cachedPublishedAt,
      });
    }
  }

  console.log(`\nTenants válidos: ${tenants.length}`);
  console.log(`Falhas ao validar tenants: ${tenantErrors}`);
  console.log(`Todas as vagas públicas encontradas no índice: ${publicIndexCount}`);
  console.log(`Fora da janela já pelo índice: ${outsideWindowBySummary}`);
  console.log(`Fora da janela usando cache confiável: ${outsideWindowByCache}`);
  console.log(`Sem data no índice: ${withoutDateInSummary}`);
  console.log(`Acertos no cache de data: ${cacheHits}`);
  console.log(`Ausentes no cache de data: ${cacheMisses}`);
  console.log(`Cache expirado ou resumo alterado: ${cacheExpiredOrChanged}`);
  console.log(`Candidatas a detalhe: ${detailCandidates.length}`);
  console.log("\nBuscando detalhes somente das candidatas...");

  let detailDone = 0;

  const mappedJobs = await mapPool(
    detailCandidates,
    async ({ tenant, summary, cacheKey, summaryFingerprint, cachedPublishedAt }) => {
      const jobId = firstValue(summary?.jobId, summary?.id);
      let detail = null;

      try {
        detail = await fetchJobDetail(tenant.slug, jobId);
      } catch (error) {
        console.warn(
          `[${tenant.slug}:${jobId}] detalhe falhou: ${
            error instanceof Error ? error.message : error
          }`,
        );
      }

      detailDone += 1;

      if (detailDone % 100 === 0 || detailDone === detailCandidates.length) {
        console.log(`Detalhes processados: ${detailDone}/${detailCandidates.length}`);
      }

      const mapped = mapInHireJob({
        tenant,
        summary,
        detail,
        cachedPublishedAt,
      });

      if (
        cacheKey &&
        mapped.published_at &&
        parseDate(mapped.published_at) &&
        mapped.published_at_source === "inhire_publication_or_created"
      ) {
        publishedCache.set(cacheKey, {
          published_at: mapped.published_at,
          summary_fingerprint: summaryFingerprint,
          checked_at: new Date().toISOString(),
        });
      }

      return mapped;
    },
    DETAIL_CONCURRENCY,
  );

  await savePublishedCache(publishedCache, activeCacheKeys);

  const byId = new Map();
  let outsideWindowAfterDetail = 0;
  let withoutPublishedDate = 0;

  for (const rawJob of mappedJobs) {
    if (!rawJob.external_id) {
      continue;
    }

    if (!rawJob.published_at || !parseDate(rawJob.published_at)) {
      withoutPublishedDate += 1;
      continue;
    }

    if (!isWithinWindow(rawJob.published_at, WINDOW_DAYS)) {
      outsideWindowAfterDetail += 1;
      continue;
    }

    const job = standardizeJob(rawJob);
    byId.set(job.external_id, job);
  }

  const uniqueJobs = [...byId.values()];
  const validJobs = [];
  const invalidJobs = [];

  for (const job of uniqueJobs) {
    const errors = validateStandardJob(job);

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

  validJobs.sort((a, b) => {
    const dateA = parseDate(a.published_at)?.getTime() ?? 0;
    const dateB = parseDate(b.published_at)?.getTime() ?? 0;
    return dateB - dateA;
  });

  await fs.writeFile(OUTPUT_FILE, JSON.stringify(validJobs, null, 2), "utf8");

  const { workplaceSummary, senioritySummary, categorySummary, contractSummary } =
    summarize(validJobs);

  console.log("\n====================================");
  console.log("RESUMO");
  console.log("====================================");
  console.log(`Tenants conhecidos: ${tenantSeeds.length}`);
  console.log(`Tenants válidos agora: ${tenants.length}`);
  console.log(`Vagas públicas no índice: ${publicIndexCount}`);
  console.log(`Fora dos ${WINDOW_DAYS} dias pelo índice: ${outsideWindowBySummary}`);
  console.log(`Fora dos ${WINDOW_DAYS} dias pelo cache: ${outsideWindowByCache}`);
  console.log(`Fora dos ${WINDOW_DAYS} dias após detalhe: ${outsideWindowAfterDetail}`);
  console.log(`Detalhes realmente consultados: ${detailCandidates.length}`);
  console.log(`Acertos no cache de published_at: ${cacheHits}`);
  console.log(`Sem published_at confiável: ${withoutPublishedDate}`);
  console.log(`Vagas únicas na janela: ${uniqueJobs.length}`);
  console.log(`Vagas válidas na janela: ${validJobs.length}`);
  console.log(`Vagas inválidas na janela: ${invalidJobs.length}`);

  console.log("\nModalidade:");
  console.table(workplaceSummary);

  console.log("\nSenioridade:");
  console.table(senioritySummary);

  console.log("\nCategoria:");
  console.table(categorySummary);

  console.log("\nContrato:");
  console.table(contractSummary);

  console.log("\n====================================");
  console.log("DRY RUN FINALIZADO");
  console.log(`JSON padrão gerado: ${OUTPUT_FILE}`);
  console.log("Nenhum dado foi gravado no Supabase.");
  console.log("====================================");
}

main().catch((error) => {
  console.error("Falha fatal no coletor InHire:", error);
  process.exitCode = 1;
});
