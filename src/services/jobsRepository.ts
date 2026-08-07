import { getSupabaseClient } from "@/lib/supabase";
import type {
  ContractType,
  Job,
  JobQuery,
  JobQueryResult,
  JobSource,
  Seniority,
  WorkplaceType,
} from "@/types/job";

/**
 * Contrato do repositório de vagas.
 *
 * Os dados são carregados da tabela public.jobs do Supabase.
 */
export interface JobsRepository {
  search(query: JobQuery): Promise<JobQueryResult>;
  getById(id: string): Promise<Job | null>;
  listFacets(): Promise<{
    states: string[];
    categories: string[];
  }>;
}

interface JobRow {
  id: string;
  source: string;
  external_id: string;
  title: string;
  company: string;
  category: string | null;
  seniority: string | null;
  workplace_type: string | null;
  contract_type: string | null;
  location_text: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  application_url: string;
  description: string | null;
  application_deadline: string | null;
  skills: string[] | null;
  published_at: string | null;
  first_seen_at: string;
  last_seen_at: string;
  active: boolean;
}

const JOB_COLUMNS = [
  "id",
  "source",
  "external_id",
  "title",
  "company",
  "category",
  "seniority",
  "workplace_type",
  "contract_type",
  "location_text",
  "city",
  "state",
  "country",
  "application_url",
  "description",
  "application_deadline",
  "skills",
  "published_at",
  "first_seen_at",
  "last_seen_at",
  "active",
].join(",");

const CACHE_TTL_MS = 5 * 60 * 1000;
const PAGE_SIZE = 1000;

let cache: {
  jobs: Job[];
  expiresAt: number;
} | null = null;

let pendingLoad: Promise<Job[]> | null = null;

const normalize = (value: string | null | undefined) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

function mapSource(value: string): JobSource {
  return normalize(value) === "inhire" ? "inhire" : "gupy";
}

function mapWorkplace(value: string | null): WorkplaceType {
  const normalized = normalize(value);

  if (normalized === "remote" || normalized.includes("remot")) {
    return "remoto";
  }

  if (normalized === "hybrid" || normalized.includes("hibr")) {
    return "hibrido";
  }

  if (normalized === "onsite" || normalized === "on-site" || normalized.includes("presenc")) {
    return "presencial";
  }

  return "nao_informado";
}

function mapContract(value: string | null): ContractType {
  const normalized = normalize(value);

  if (normalized.includes("clt") || normalized.includes("efetiv")) {
    return "clt";
  }

  if (normalized === "pj" || normalized.includes("pessoa juridica")) {
    return "pj";
  }

  if (normalized.includes("estag")) {
    return "estagio";
  }

  if (normalized.includes("tempor")) {
    return "temporario";
  }

  return "nao_informado";
}

function mapSeniority(value: string | null, title: string): Seniority {
  const normalized = normalize(`${value ?? ""} ${title}`);

  if (/\b(estagio|estagiario|intern)\b/.test(normalized)) {
    return "estagio";
  }

  if (/\b(junior|jr)\b/.test(normalized)) {
    return "junior";
  }

  if (/\b(pleno|mid level|mid-level)\b/.test(normalized)) {
    return "pleno";
  }

  if (/\b(senior|sr|lead|principal)\b/.test(normalized)) {
    return "senior";
  }

  if (/\b(especialista|specialist|staff|expert)\b/.test(normalized)) {
    return "especialista";
  }

  return "nao_informado";
}

function rowToJob(row: JobRow): Job {
  const publishedAt = row.published_at ?? row.first_seen_at;

  const workplaceType = mapWorkplace(row.workplace_type);

  const locationText =
    row.location_text ||
    [row.city, row.state].filter(Boolean).join(", ") ||
    (workplaceType === "remoto" ? "Remoto - Brasil" : "Local não informado");

  const description =
    row.description?.trim() ||
    "A descrição completa desta oportunidade está disponível no anúncio original da empresa.";

  return {
    id: row.id,

    source: mapSource(row.source),

    externalId: row.external_id,

    title: row.title,

    company: row.company,

    description,

    requirements: [
      "Consulte a descrição da vaga e o anúncio original para conferir todos os requisitos e condições.",
    ],

    city: row.city ?? "",

    state: row.state ?? "",

    country: row.country ?? "Brasil",

    locationText,

    workplaceType,

    contractType: mapContract(row.contract_type),

    seniority: mapSeniority(row.seniority, row.title),

    category: row.category || "Outras áreas",

    skills: row.skills ?? [],

    applicationUrl: row.application_url,

    applicationDeadline: row.application_deadline,

    publishedAt,

    firstSeenAt: row.first_seen_at,

    lastSeenAt: row.last_seen_at,

    active: row.active,
  };
}

async function loadAllActiveJobs(): Promise<Job[]> {
  if (cache && cache.expiresAt > Date.now()) {
    return cache.jobs;
  }

  if (pendingLoad) {
    return pendingLoad;
  }

  pendingLoad = (async () => {
    const supabase = getSupabaseClient();

    const rows: JobRow[] = [];

    for (let from = 0; ; from += PAGE_SIZE) {
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from("jobs")
        .select(JOB_COLUMNS)
        .eq("active", true)
        .order("published_at", {
          ascending: false,
        })
        .range(from, to);

      if (error) {
        throw new Error(`Falha ao carregar vagas do Supabase: ${error.message}`);
      }

      const page = (data ?? []) as unknown as JobRow[];

      rows.push(...page);

      if (page.length < PAGE_SIZE) {
        break;
      }
    }

    const jobs = rows.map(rowToJob);

    cache = {
      jobs,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };

    return jobs;
  })().finally(() => {
    pendingLoad = null;
  });

  return pendingLoad;
}

function scoreJob(job: Job, terms: string[]): number {
  if (terms.length === 0) {
    return 0;
  }

  const title = normalize(job.title);

  const company = normalize(job.company);

  const skills = job.skills?.join(" ") ?? "";

  const rest = normalize(
    `${job.category} ${job.locationText} ${job.description} ${job.requirements.join(
      " ",
    )} ${skills}`,
  );

  return terms.reduce((score, term) => {
    if (title.includes(term)) {
      score += 10;
    }

    if (company.includes(term)) {
      score += 6;
    }

    if (rest.includes(term)) {
      score += 2;
    }

    return score;
  }, 0);
}

function matches(job: Job, query: JobQuery, terms: string[]): boolean {
  if (!job.active) {
    return false;
  }

  if (terms.length > 0 && scoreJob(job, terms) === 0) {
    return false;
  }

  if (
    query.workplaceType &&
    query.workplaceType !== "todos" &&
    job.workplaceType !== query.workplaceType
  ) {
    return false;
  }

  if (query.seniority && query.seniority !== "todos" && job.seniority !== query.seniority) {
    return false;
  }

  if (
    query.contractType &&
    query.contractType !== "todos" &&
    job.contractType !== query.contractType
  ) {
    return false;
  }

  if (query.source && query.source !== "todos" && job.source !== query.source) {
    return false;
  }

  if (query.state && query.state !== "todos" && job.state !== query.state) {
    return false;
  }

  if (query.category && query.category !== "todos" && job.category !== query.category) {
    return false;
  }

  return true;
}

export const supabaseJobsRepository: JobsRepository = {
  async search(query) {
    const jobs = await loadAllActiveJobs();

    const terms = query.q ? normalize(query.q).split(/\s+/).filter(Boolean) : [];

    const filtered = jobs.filter((job) => matches(job, query, terms));

    const sorted = [...filtered].sort((a, b) => {
      if (query.sort === "relevancia" && terms.length > 0) {
        const difference = scoreJob(b, terms) - scoreJob(a, terms);

        if (difference !== 0) {
          return difference;
        }
      }

      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });

    return {
      jobs: sorted,
      total: sorted.length,
    };
  },

  async getById(id) {
    const jobs = await loadAllActiveJobs();

    return jobs.find((job) => job.id === id) ?? null;
  },

  async listFacets() {
    const jobs = await loadAllActiveJobs();

    const states = [...new Set(jobs.map((job) => job.state).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    );

    const categories = [...new Set(jobs.map((job) => job.category).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    );

    return {
      states,
      categories,
    };
  },
};

export const jobsRepository: JobsRepository = supabaseJobsRepository;
