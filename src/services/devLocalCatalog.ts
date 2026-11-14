import type {
  ContractType, Job, JobQuery, JobQueryResult, JobSource, Seniority,
  WorkplaceType,
} from "@/types/job";

interface PreviewRow {
  source: JobSource;
  external_id: string;
  title: string;
  company: string;
  category: string | null;
  seniority: Seniority | null;
  workplace_type: WorkplaceType | null;
  source_workplace_type?: string | null;
  contract_type: ContractType | null;
  source_contract_type?: string | null;
  location_text: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string | null;
  salary_interval?: string | null;
  salary_description?: string | null;
  application_url: string;
  application_deadline?: string | null;
  description?: string | null;
  skills: string[] | null;
  published_at: string;
  published_at_source?: string | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  active: boolean;
}

function toJob(row: PreviewRow): Job {
  return {
    id: "local:" + row.source + ":" + row.external_id,
    source: row.source,
    externalId: row.external_id,
    title: row.title,
    company: row.company,
    category: row.category ?? "Outros",
    seniority: row.seniority ?? "nao_informado",
    workplaceType: row.workplace_type ?? "unknown",
    sourceWorkplaceType: row.source_workplace_type ?? null,
    contractType: row.contract_type ?? "nao_informado",
    sourceContractType: row.source_contract_type ?? null,
    locationText: row.location_text ?? "Local não informado",
    city: row.city ?? "",
    state: row.state ?? "",
    ...(row.country ? { country: row.country } : {}),
    salaryMin: row.salary_min ?? null,
    salaryMax: row.salary_max ?? null,
    salaryCurrency: row.salary_currency ?? null,
    salaryInterval: row.salary_interval ?? null,
    salaryDescription: row.salary_description ?? null,
    description:
      row.description ??
      "Consulte a página original da vaga para a descrição e os requisitos completos.",
    requirements: [],
    skills: Array.isArray(row.skills) ? row.skills : [],
    applicationUrl: row.application_url,
    applicationDeadline: row.application_deadline ?? null,
    publishedAt: row.published_at,
    publishedAtSource: row.published_at_source ?? null,
    firstSeenAt: row.first_seen_at ?? row.published_at,
    lastSeenAt: row.last_seen_at ?? row.published_at,
    active: row.active !== false,
  };
}

/**
 * A prévia do catálogo só funciona no Vite DEV. Ela nunca acessa o Supabase e
 * não embute o JSON de 20 mil vagas no bundle/servidor de produção.
 */
export async function searchLocalPreviewJobs(query: JobQuery): Promise<JobQueryResult> {
  if (!import.meta.env.DEV) {
    throw new Error("A prévia local está disponível somente em desenvolvimento.");
  }

  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  if (query.q) params.set("q", query.q);
  for (const [key, value] of [
    ["workplaceType", query.workplaceType],
    ["seniority", query.seniority],
    ["state", query.state],
    ["category", query.category],
    ["contractType", query.contractType],
    ["source", query.source],
  ]) {
    if (value && value !== "todos") params.set(key!, value);
  }

  const response = await fetch("/api/radar-preview/jobs?" + params.toString(), {
    cache: "no-store",
  });
  const payload = (await response.json()) as {
    jobs?: PreviewRow[];
    total?: number;
    error?: string;
  };
  if (!response.ok) {
    throw new Error(payload.error ?? "Falha ao abrir a prévia local.");
  }
  return {
    jobs: (payload.jobs ?? []).map(toJob),
    total: payload.total ?? 0,
  };
}
