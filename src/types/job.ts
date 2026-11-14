export type JobSource = "gupy" | "inhire" | "greenhouse" | "lever" | "ashby" | "infojobs" | "unknown";

export type WorkplaceType = "remote" | "hybrid" | "onsite" | "unknown";

export type ContractType = "clt" | "pj" | "estagio" | "temporario" | "nao_informado";

export type Seniority =
  "estagio" | "junior" | "pleno" | "senior" | "especialista" | "nao_informado";

export interface Job {
  id: string;

  source: JobSource;
  externalId: string;

  title: string;
  company: string;
  companyLogo?: string;

  category: string;
  seniority: Seniority;

  workplaceType: WorkplaceType;
  sourceWorkplaceType?: string | null;

  contractType: ContractType;
  sourceContractType?: string | null;

  locationText: string;
  city: string;
  state: string;
  country?: string;

  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  salaryInterval?: string | null;
  salaryDescription?: string | null;

  description: string;
  requirements: string[];
  skills?: string[];

  applicationUrl: string;
  applicationDeadline?: string | null;

  publishedAt: string;
  publishedAtSource?: string | null;

  firstSeenAt: string;
  lastSeenAt: string;

  active: boolean;
}

export type SortOption = "recentes" | "relevancia";

export interface JobQuery {
  q?: string;

  workplaceType?: WorkplaceType | "todos";
  seniority?: Seniority | "todos";

  state?: string;
  category?: string;

  contractType?: ContractType | "todos";
  source?: JobSource | "todos";

  sort?: SortOption;

  /** Página 1-based para consulta no servidor. */
  page?: number;
  /** Quantidade máxima por página, limitada a 20. */
  pageSize?: number;
}

export interface JobQueryResult {
  jobs: Job[];
  total: number;
}

export const WORKPLACE_LABELS: Record<WorkplaceType, string> = {
  remote: "Remoto",
  hybrid: "Híbrido",
  onsite: "Presencial",
  unknown: "Não informado",
};

export const CONTRACT_LABELS: Record<ContractType, string> = {
  clt: "CLT",
  pj: "PJ",
  estagio: "Estágio",
  temporario: "Temporário",
  nao_informado: "Não informado",
};

export const SENIORITY_LABELS: Record<Seniority, string> = {
  estagio: "Estágio",
  junior: "Júnior",
  pleno: "Pleno",
  senior: "Sênior",
  especialista: "Especialista",
  nao_informado: "Não informado",
};

export const SOURCE_LABELS: Record<JobSource, string> = {
  gupy: "Gupy",
  inhire: "InHire",
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  infojobs: "InfoJobs",
  unknown: "Fonte não identificada",
};
