import { getSupabaseClient } from "@/lib/supabase";
import { BRAZIL_STATES, JOB_CATEGORIES, buildJobsPagePlan } from "./jobs-query";
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
  source_workplace_type: string | null;
  source_contract_type: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_interval: string | null;
  salary_description: string | null;
  published_at_source: string | null;
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
  "source_workplace_type",
  "source_contract_type",
  "salary_min",
  "salary_max",
  "salary_currency",
  "salary_interval",
  "salary_description",
  "published_at_source",
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

const normalize = (value: string | null | undefined) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

function mapSource(value: string): JobSource {
  const source = normalize(value);

  if (source === "gupy") return "gupy";
  if (source === "inhire") return "inhire";
  if (source === "greenhouse") return "greenhouse";
  if (source === "lever") return "lever";
  if (source === "ashby") return "ashby";
  if (source === "infojobs") return "infojobs";

  return "unknown";
}

function mapWorkplace(value: string | null): WorkplaceType {
  const normalized = normalize(value);

  if (normalized === "remote" || normalized.includes("remot")) {
    return "remote";
  }

  if (normalized === "hybrid" || normalized.includes("hibr")) {
    return "hybrid";
  }

  if (normalized === "onsite" || normalized === "on-site" || normalized.includes("presenc")) {
    return "onsite";
  }

  return "unknown";
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
    (workplaceType === "remote" ? "Remoto · localidade não informada" : "Local não informado");

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

    country: row.country ?? undefined,

    locationText,

    workplaceType,

    contractType: mapContract(row.contract_type),
    sourceContractType: row.source_contract_type,
    sourceWorkplaceType: row.source_workplace_type,

    salaryMin: row.salary_min,
    salaryMax: row.salary_max,
    salaryCurrency: row.salary_currency,
    salaryInterval: row.salary_interval,
    salaryDescription: row.salary_description,

    seniority: mapSeniority(row.seniority, row.title),

    category: row.category || "Outras áreas",

    skills: row.skills ?? [],

    applicationUrl: row.application_url,

    applicationDeadline: row.application_deadline,

    publishedAt,
    publishedAtSource: row.published_at_source,

    firstSeenAt: row.first_seen_at,

    lastSeenAt: row.last_seen_at,

    active: row.active,
  };
}

/**
 * Paginação e filtros executados no PostgreSQL, sem transferência do catálogo
 * inteiro para o navegador. A consulta devolve no máximo 20 vagas por página.
 *
 * "Relevância" ainda depende de uma futura busca full-text no banco;
 * por enquanto a ordenação real e declarada ao usuário é "mais recentes".
 */
export const supabaseJobsRepository: JobsRepository = {
  async search(query) {
    const plan = buildJobsPagePlan(query);
    let request = getSupabaseClient()
      .from("jobs")
      .select(JOB_COLUMNS, { count: "exact" })
      .eq("active", true)
      .gte("published_at", plan.publishedAfter)
      .lte("published_at", plan.publishedBefore);

    if (query.workplaceType && query.workplaceType !== "todos") {
      request = request.eq("workplace_type", query.workplaceType);
    }
    if (query.seniority && query.seniority !== "todos") {
      request = request.eq("seniority", query.seniority);
    }
    if (query.contractType && query.contractType !== "todos") {
      request = request.eq("contract_type", query.contractType);
    }
    if (query.source && query.source !== "todos" && query.source !== "unknown") {
      request = request.eq("source", query.source);
    }
    if (query.state && query.state !== "todos") {
      request = request.eq("state", query.state);
    }
    if (query.category && query.category !== "todos") {
      request = request.eq("category", query.category);
    }
    if (plan.searchFilter) {
      request = request.or(plan.searchFilter);
    }

    const { data, error, count } = await request
      .order("published_at", { ascending: false })
      .order("id", { ascending: true })
      .range(plan.from, plan.to);

    if (error) {
      throw new Error("Falha ao buscar vagas no Supabase: " + error.message);
    }

    return {
      jobs: ((data ?? []) as JobRow[]).map(rowToJob),
      total: count ?? 0,
    };
  },

  async getById(id) {
    // A tabela usa identificadores UUID; evita consultas inválidas no PostgREST.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return null;
    }

    const plan = buildJobsPagePlan({});
    const { data, error } = await getSupabaseClient()
      .from("jobs")
      .select(JOB_COLUMNS)
      .eq("id", id)
      .eq("active", true)
      .gte("published_at", plan.publishedAfter)
      .lte("published_at", plan.publishedBefore)
      .maybeSingle();

    if (error) {
      throw new Error("Falha ao carregar detalhe da vaga: " + error.message);
    }
    return data ? rowToJob(data as JobRow) : null;
  },

  async listFacets() {
    return {
      states: [...BRAZIL_STATES],
      categories: [...JOB_CATEGORIES],
    };
  },
};

export const jobsRepository: JobsRepository = supabaseJobsRepository;
