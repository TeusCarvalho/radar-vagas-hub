import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Search, SlidersHorizontal, AlertCircle, SearchX } from "lucide-react";

import { JobCard } from "@/components/job-card";
import { JobFilters, type FilterState } from "@/components/job-filters";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { jobsRepository } from "@/services/jobsRepository";
import { jobsSeed } from "@/data/jobs";
import type {
  ContractType,
  JobQuery,
  JobSource,
  Seniority,
  SortOption,
  WorkplaceType,
} from "@/types/job";

interface VagasSearch {
  q: string;
  modalidade: string;
  nivel: string;
  estado: string;
  area: string;
  contrato: string;
  origem: string;
  ordem: string;
}

const str = (value: unknown, fallback: string) =>
  typeof value === "string" && value.length > 0 ? value : fallback;

export const Route = createFileRoute("/vagas")({
  validateSearch: (search: Record<string, unknown>): VagasSearch => ({
    q: str(search["q"], ""),
    modalidade: str(search["modalidade"], "todos"),
    nivel: str(search["nivel"], "todos"),
    estado: str(search["estado"], "todos"),
    area: str(search["area"], "todos"),
    contrato: str(search["contrato"], "todos"),
    origem: str(search["origem"], "todos"),
    ordem: str(search["ordem"], "recentes"),
  }),
  head: () => ({
    meta: [
      { title: "Buscar vagas de emprego | Radar Vagas" },
      {
        name: "description",
        content:
          "Pesquise vagas por cargo, empresa ou palavra-chave e filtre por modalidade, senioridade, estado, área, contrato e plataforma de origem.",
      },
      { property: "og:title", content: "Buscar vagas de emprego | Radar Vagas" },
      {
        property: "og:description",
        content: "Filtros de modalidade, senioridade, estado, área e plataforma em um só lugar.",
      },
    ],
  }),
  component: VagasPage,
});

const states = [...new Set(jobsSeed.map((j) => j.state))].sort();
const categories = [...new Set(jobsSeed.map((j) => j.category))].sort();

function VagasPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [term, setTerm] = useState(search.q);

  useEffect(() => {
    setTerm(search.q);
  }, [search.q]);

  const query: JobQuery = {
    q: search.q,
    workplaceType: search.modalidade as WorkplaceType | "todos",
    seniority: search.nivel as Seniority | "todos",
    state: search.estado,
    category: search.area,
    contractType: search.contrato as ContractType | "todos",
    source: search.origem as JobSource | "todos",
    sort: search.ordem as SortOption,
  };

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["jobs", search],
    queryFn: () => jobsRepository.search(query),
  });

  const filters: FilterState = {
    workplaceType: search.modalidade,
    seniority: search.nivel,
    state: search.estado,
    category: search.area,
    contractType: search.contrato,
    source: search.origem,
  };

  const filterKeyMap: Record<keyof FilterState, keyof VagasSearch> = {
    workplaceType: "modalidade",
    seniority: "nivel",
    state: "estado",
    category: "area",
    contractType: "contrato",
    source: "origem",
  };

  const hasActiveFilters =
    Object.values(filters).some((v) => v !== "todos") || search.q.length > 0;

  const updateFilter = (key: keyof FilterState, value: string) => {
    navigate({ to: ".", search: (prev: VagasSearch) => ({ ...prev, [filterKeyMap[key]]: value }) });
  };

  const clearAll = () => {
    navigate({
      to: ".",
      search: {
        q: "",
        modalidade: "todos",
        nivel: "todos",
        estado: "todos",
        area: "todos",
        contrato: "todos",
        origem: "todos",
        ordem: "recentes",
      },
    });
  };

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    navigate({ to: ".", search: (prev: VagasSearch) => ({ ...prev, q: term.trim() }) });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          Vagas abertas
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pesquise por cargo, palavra-chave ou empresa e refine com os filtros.
        </p>

        <form onSubmit={submitSearch} className="mt-6 flex flex-col gap-3 sm:flex-row" role="search">
          <div className="relative flex-1">
            <Label htmlFor="busca-vagas" className="sr-only">
              Buscar vagas
            </Label>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="busca-vagas"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Cargo, palavra-chave ou empresa"
              className="h-12 bg-surface pl-9 text-base"
            />
          </div>
          <Button type="submit" size="lg" className="h-12">
            Buscar vagas
          </Button>
        </form>

        <div className="mt-8 grid gap-6 lg:grid-cols-[280px_1fr]">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <JobFilters
              value={filters}
              states={states}
              categories={categories}
              hasActiveFilters={hasActiveFilters}
              onChange={updateFilter}
              onClear={clearAll}
            />
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-card">
              <p className="text-sm font-semibold text-foreground" aria-live="polite">
                {isPending
                  ? "Carregando vagas…"
                  : `${data?.total ?? 0} ${data?.total === 1 ? "vaga encontrada" : "vagas encontradas"}`}
              </p>
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="size-4 text-muted-foreground" aria-hidden="true" />
                <Label htmlFor="ordenacao" className="sr-only">
                  Ordenar por
                </Label>
                <Select
                  value={search.ordem}
                  onValueChange={(value) =>
                    navigate({ to: ".", search: (prev: VagasSearch) => ({ ...prev, ordem: value }) })
                  }
                >
                  <SelectTrigger id="ordenacao" className="h-9 w-[180px] bg-surface">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recentes">Mais recentes</SelectItem>
                    <SelectItem value="relevancia">Relevância</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isPending && (
              <div className="mt-4 space-y-4">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-48 w-full rounded-2xl" />
                ))}
              </div>
            )}

            {isError && (
              <div
                role="alert"
                className="mt-4 rounded-2xl border border-destructive/30 bg-card p-8 text-center shadow-card"
              >
                <AlertCircle className="mx-auto size-8 text-destructive" aria-hidden="true" />
                <h2 className="mt-3 text-base font-bold text-foreground">
                  Não foi possível carregar as vagas
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ocorreu um erro na busca. Tente novamente em instantes.
                </p>
                <Button className="mt-4" onClick={() => refetch()}>
                  Tentar novamente
                </Button>
              </div>
            )}

            {!isPending && !isError && data && data.jobs.length === 0 && (
              <div className="mt-4 rounded-2xl border border-border bg-card p-10 text-center shadow-card">
                <SearchX className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
                <h2 className="mt-3 text-base font-bold text-foreground">Nenhuma vaga encontrada</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Tente outras palavras-chave ou remova alguns filtros.
                </p>
                <Button variant="outline" className="mt-4" onClick={clearAll}>
                  Limpar filtros
                </Button>
              </div>
            )}

            {!isPending && !isError && data && data.jobs.length > 0 && (
              <div className="mt-4 space-y-4">
                {data.jobs.map((job) => (
                  <JobCard key={job.id} job={job} />
                ))}
              </div>
            )}
          </div>
        </div>

        <p className="mt-10 text-center text-sm text-muted-foreground">
          Não achou o que procurava?{" "}
          <Link to="/" className="font-semibold text-brand hover:underline">
            Voltar para a página inicial
          </Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
