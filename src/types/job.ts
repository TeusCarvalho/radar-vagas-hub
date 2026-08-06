export type JobSource = "gupy" | "inhire";

export type WorkplaceType = "remoto" | "hibrido" | "presencial" | "nao_informado";

export type ContractType = "clt" | "pj" | "estagio" | "temporario" | "nao_informado";

export type Seniority =
  | "estagio"
  | "junior"
  | "pleno"
  | "senior"
  | "especialista"
  | "nao_informado";

export interface Job {
  id: string;
  source: JobSource;
  externalId: string;
  title: string;
  company: string;
  companyLogo?: string;
  description: string;
  requirements: string[];
  city: string;
  state: string;
  locationText: string;
  workplaceType: WorkplaceType;
  contractType: ContractType;
  seniority: Seniority;
  category: string;
  applicationUrl: string;
  publishedAt: string;
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
}

export interface JobQueryResult {
  jobs: Job[];
  total: number;
}

export const WORKPLACE_LABELS: Record<WorkplaceType, string> = {
  remoto: "Remoto",
  hibrido: "Híbrido",
  presencial: "Presencial",
  nao_informado: "Não informado",
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
};
