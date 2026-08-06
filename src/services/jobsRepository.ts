import { jobsSeed } from "@/data/jobs";
import type { Job, JobQuery, JobQueryResult } from "@/types/job";

/**
 * Contrato do repositório de vagas.
 * Hoje é implementado com dados locais; ao habilitar o backend
 * (Supabase/PostgreSQL + coletor Gupy/InHire), basta criar uma nova
 * implementação desta interface — as páginas não mudam.
 */
export interface JobsRepository {
  search(query: JobQuery): Promise<JobQueryResult>;
  getById(id: string): Promise<Job | null>;
  listFacets(): Promise<{ states: string[]; categories: string[] }>;
}

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

function scoreJob(job: Job, terms: string[]): number {
  if (terms.length === 0) return 0;
  const title = normalize(job.title);
  const company = normalize(job.company);
  const rest = normalize(`${job.category} ${job.description} ${job.requirements.join(" ")}`);
  return terms.reduce((score, term) => {
    if (title.includes(term)) score += 10;
    if (company.includes(term)) score += 6;
    if (rest.includes(term)) score += 2;
    return score;
  }, 0);
}

function matches(job: Job, query: JobQuery, terms: string[]): boolean {
  if (!job.active) return false;
  if (terms.length > 0 && scoreJob(job, terms) === 0) return false;
  if (query.workplaceType && query.workplaceType !== "todos" && job.workplaceType !== query.workplaceType)
    return false;
  if (query.seniority && query.seniority !== "todos" && job.seniority !== query.seniority) return false;
  if (query.contractType && query.contractType !== "todos" && job.contractType !== query.contractType)
    return false;
  if (query.source && query.source !== "todos" && job.source !== query.source) return false;
  if (query.state && query.state !== "todos" && job.state !== query.state) return false;
  if (query.category && query.category !== "todos" && job.category !== query.category) return false;
  return true;
}

const delay = (ms = 220) => new Promise((resolve) => setTimeout(resolve, ms));

export const localJobsRepository: JobsRepository = {
  async search(query) {
    await delay();
    const terms = query.q ? normalize(query.q).split(/\s+/).filter(Boolean) : [];
    const filtered = jobsSeed.filter((job) => matches(job, query, terms));

    const sorted = [...filtered].sort((a, b) => {
      if (query.sort === "relevancia" && terms.length > 0) {
        const diff = scoreJob(b, terms) - scoreJob(a, terms);
        if (diff !== 0) return diff;
      }
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });

    return { jobs: sorted, total: sorted.length };
  },

  async getById(id) {
    await delay(140);
    return jobsSeed.find((job) => job.id === id) ?? null;
  },

  async listFacets() {
    const states = [...new Set(jobsSeed.map((j) => j.state))].sort();
    const categories = [...new Set(jobsSeed.map((j) => j.category))].sort();
    return { states, categories };
  },
};

export const jobsRepository: JobsRepository = localJobsRepository;
