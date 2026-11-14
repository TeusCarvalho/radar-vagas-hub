import { createFileRoute, Link, useNavigate, type SearchSchemaInput } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Search,
  SearchX,
  SlidersHorizontal,
} from "lucide-react";

import { JobCard } from "@/components/job-card";
import { JobFilters, type FilterState } from "@/components/job-filters";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

import { jobsRepository } from "@/services/jobsRepository";
import { JOBS_PER_PAGE } from "@/services/jobs-query";
import { searchLocalPreviewJobs } from "@/services/devLocalCatalog";

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
  pagina: number;
  previa: string;
}

type VagasSearchInput = Partial<VagasSearch>;

const str = (value: unknown, fallback: string) =>
  typeof value === "string" && value.length > 0 ? value : fallback;

const positiveInt = (value: unknown, fallback = 1) => {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
};

export const Route = createFileRoute("/vagas")({
  validateSearch: (search: VagasSearchInput & SearchSchemaInput): VagasSearch => ({
    q: str(search.q, ""),
    modalidade: str(search.modalidade, "todos"),
    nivel: str(search.nivel, "todos"),
    estado: str(search.estado, "todos"),
    area: str(search.area, "todos"),
    contrato: str(search.contrato, "todos"),
    origem: str(search.origem, "todos"),
    // Ordenação por relevância requer índice/ranqueamento no banco.
    // Até lá, não anunciamos um critério que a consulta não executa.
    ordem: "recentes",
    pagina: positiveInt(search.pagina, 1),
    previa: search.previa === "local" ? "local" : "",
  }),

  head: () => ({
    meta: [
      {
        title: "Buscar vagas de emprego | Radar Vagas",
      },
      {
        name: "description",
        content:
          "Pesquise vagas por cargo, empresa ou palavra-chave e filtre por modalidade, senioridade, estado, área, contrato e plataforma de origem.",
      },
      {
        property: "og:title",
        content: "Buscar vagas de emprego | Radar Vagas",
      },
      {
        property: "og:description",
        content: "Filtros de modalidade, senioridade, estado, área e plataforma em um só lugar.",
      },
    ],
  }),

  component: VagasPage,
});

function VagasPage() {
  const search = Route.useSearch();

  const navigate = useNavigate({
    from: Route.fullPath,
  });

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
    page: search.pagina,
    pageSize: JOBS_PER_PAGE,
  };

  // Sem configuração pública do Supabase, o ambiente DEV abre o catálogo
  // local automaticamente. A versão de produção nunca utiliza essa prévia.
  const hasSupabaseConfig = Boolean(
    import.meta.env.VITE_SUPABASE_URL?.trim() &&
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim(),
  );
  const isAutomaticLocalPreview = import.meta.env.DEV && !hasSupabaseConfig;
  const isLocalPreview =
    import.meta.env.DEV && (isAutomaticLocalPreview || search.previa === "local");

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["jobs", isLocalPreview ? "preview-local" : "supabase", query],
    queryFn: () =>
      isLocalPreview ? searchLocalPreviewJobs(query) : jobsRepository.search(query),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const { data: facets } = useQuery({
    queryKey: ["jobs-facets"],
    queryFn: () => jobsRepository.listFacets(),
  });

  const states = facets?.states ?? [];
  const categories = facets?.categories ?? [];

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

  const appliedFilterCount = Object.values(filters).filter((value) => value !== "todos").length;
  const hasActiveFilters = appliedFilterCount > 0 || search.q.length > 0;
  const [showFilters, setShowFilters] = useState(
    [search.nivel, search.estado, search.area, search.contrato, search.origem]
      .some((value) => value !== "todos"),
  );

  // Cada consulta já retorna somente a página solicitada pelo servidor.
  const paginatedJobs = data?.jobs ?? [];
  const totalJobs = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalJobs / JOBS_PER_PAGE));
  const currentPage = Math.min(Math.max(search.pagina, 1), totalPages);
  const firstVisible = totalJobs === 0 ? 0 : (currentPage - 1) * JOBS_PER_PAGE + 1;
  const lastVisible = Math.min(currentPage * JOBS_PER_PAGE, totalJobs);

  // URLs antigas com ?pagina=9999 não devem apresentar uma página vazia.
  useEffect(() => {
    if (!isPending && !isError && data && search.pagina > totalPages) {
      navigate({
        to: ".",
        replace: true,
        search: (prev) => ({ ...prev, pagina: 1 }),
      });
    }
  }, [data, isPending, isError, search.pagina, totalPages, navigate]);

  const updateFilter = (key: keyof FilterState, value: string) => {
    navigate({
      to: ".",

      search: (prev) => ({
        ...prev,
        [filterKeyMap[key]]: value,

        // Mudou filtro -> volta para página 1
        pagina: 1,
      }),
    });
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
        pagina: 1,
        previa: search.previa,
      },
    });
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();

    navigate({
      to: ".",

      search: (prev) => ({
        ...prev,
        q: term.trim(),

        // Nova busca -> página 1
        pagina: 1,
      }),
    });
  };

  const goToPage = (page: number) => {
    const nextPage = Math.min(Math.max(page, 1), totalPages);

    navigate({
      to: ".",

      search: (prev) => ({
        ...prev,
        pagina: nextPage,
      }),
    });

    if (typeof window !== "undefined") {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand">
            Radar de oportunidades · últimos 7 dias
          </p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            Encontre sua próxima vaga
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Pesquise por cargo ou empresa e encontre oportunidades recentes em seis plataformas.
          </p>

          <form onSubmit={submitSearch} className="mt-5 flex flex-col gap-2 sm:flex-row" role="search">
            <div className="relative min-w-0 flex-1">
              <Label htmlFor="busca-vagas" className="sr-only">
                Cargo, empresa ou palavra-chave
              </Label>
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="busca-vagas"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                maxLength={120}
                placeholder="Ex.: Analista de Dados, Python ou empresa"
                className="h-12 bg-background pl-10 text-base"
              />
            </div>
            <Button type="submit" size="lg" className="h-12 px-7">
              <Search className="size-4" aria-hidden="true" />
              Buscar vagas
            </Button>
          </form>

          <div
            className="mt-4 flex flex-wrap items-center gap-2"
            role="group"
            aria-label="Filtrar rapidamente pela modalidade"
          >
            <span className="mr-1 text-xs font-semibold text-muted-foreground">
              Modalidade
            </span>
            {([
              ["todos", "Todas"],
              ["remote", "Remotas"],
              ["hybrid", "Híbridas"],
              ["onsite", "Presenciais"],
            ] as const).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={filters.workplaceType === value ? "default" : "outline"}
                aria-pressed={filters.workplaceType === value}
                onClick={() => updateFilter("workplaceType", value)}
                className="h-9 rounded-full px-3 text-xs"
              >
                {label}
              </Button>
            ))}
          </div>
        </section>

        {import.meta.env.DEV && (
          <div
            className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/30 bg-brand-soft/30 p-4"
            role="status"
          >
            <p className="text-sm text-foreground">
              {isAutomaticLocalPreview
                ? "Prévia local automática: o Supabase não está configurado neste computador. As vagas vêm do radar-jobs.json, sem gravações no banco."
                : isLocalPreview
                  ? "Prévia local ativa: resultados do radar-jobs.json. Nenhuma vaga foi enviada ao Supabase."
                  : "Consulta Supabase ativa. Você também pode visualizar o catálogo local sem alterar o banco."}
            </p>
            {isAutomaticLocalPreview ? (
              <span className="shrink-0 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground">
                Somente desenvolvimento
              </span>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  navigate({
                    to: ".",
                    search: (prev) => ({
                      ...prev,
                      previa: isLocalPreview ? "" : "local",
                      pagina: 1,
                    }),
                  })
                }
              >
                {isLocalPreview ? "Voltar à consulta Supabase" : "Prévia das vagas locais"}
              </Button>
            )}
          </div>
        )}

        <section className="mt-5" aria-label="Resultados de vagas">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <div>
              <h2 className="text-base font-bold text-foreground" aria-live="polite">
                {isPending
                  ? "Buscando oportunidades…"
                  : isError
                    ? "Não foi possível carregar as vagas"
                    : `${totalJobs.toLocaleString("pt-BR")} ${totalJobs === 1 ? "vaga encontrada" : "vagas encontradas"}`}
              </h2>
              {!isPending && !isError && totalJobs > 0 && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Mostrando {firstVisible.toLocaleString("pt-BR")}–{lastVisible.toLocaleString("pt-BR")} ·
                  Ordenadas por publicação mais recente
                </p>
              )}
            </div>

            <Button
              type="button"
              variant={showFilters ? "secondary" : "outline"}
              size="sm"
              aria-expanded={showFilters}
              aria-controls="painel-filtros"
              onClick={() => setShowFilters((current) => !current)}
              className="h-9"
            >
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              {showFilters ? "Ocultar filtros" : "Filtros"}
              {appliedFilterCount > 0 && (
                <span className="rounded-full bg-brand-soft px-1.5 text-xs font-bold text-brand">
                  {appliedFilterCount}
                </span>
              )}
            </Button>
          </div>

          {showFilters && (
            <div id="painel-filtros" className="mt-4">
              <JobFilters
                value={filters}
                states={states}
                categories={categories}
                hasActiveFilters={hasActiveFilters}
                onChange={updateFilter}
                onClear={clearAll}
              />
            </div>
          )}

            {isPending && (
              <div className="mt-4 space-y-4">
                {[0, 1, 2, 3].map((index) => (
                  <Skeleton key={index} className="h-36 w-full rounded-xl" />
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
                  Não foi possível consultar as vagas. Verifique sua conexão e as configurações do Supabase.
                  Se o problema continuar, consulte o console do navegador (F12) para identificar a causa.
                </p>

                {import.meta.env.DEV && error && (
                  <p className="mt-3 break-words rounded-md border border-border p-3 text-left text-xs text-muted-foreground">
                    Diagnóstico local: {error instanceof Error ? error.message : String(error)}
                  </p>
                )}

                <Button className="mt-4" onClick={() => refetch()}>
                  Tentar novamente
                </Button>
              </div>
            )}

            {!isPending && !isError && data && totalJobs === 0 && (
              <div className="mt-4 rounded-2xl border border-border bg-card p-10 text-center shadow-card">
                <SearchX className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />

                <h2 className="mt-3 text-base font-bold text-foreground">
                  Nenhuma vaga encontrada
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  {hasActiveFilters
                    ? "Tente outras palavras-chave ou remova alguns filtros."
                    : "Não há vagas cadastradas nos últimos 7 dias. O catálogo pode estar aguardando atualização."}
                </p>

                {hasActiveFilters && (
                  <Button variant="outline" className="mt-4" onClick={clearAll}>
                    Limpar filtros
                  </Button>
                )}
              </div>
            )}

            {!isPending && !isError && data && totalJobs > 0 && (
              <>
                <div className="mt-4 space-y-3">
                  {paginatedJobs.map((job) => (
                    <JobCard key={job.id} job={job} isLocalPreview={isLocalPreview} />
                  ))}
                </div>

                {totalPages > 1 && (
                  <nav
                    className="mt-8 flex flex-col items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 sm:flex-row"
                    aria-label="Paginação das vagas"
                  >
                    <Button
                      type="button"
                      variant="outline"
                      disabled={currentPage === 1}
                      onClick={() => goToPage(currentPage - 1)}
                    >
                      <ChevronLeft className="size-4" aria-hidden="true" />
                      Anterior
                    </Button>

                    <div className="text-center">
                      <p className="text-sm font-semibold text-foreground">
                        Página {currentPage} de {totalPages}
                      </p>

                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {firstVisible}–{lastVisible} de {totalJobs} vagas
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      disabled={currentPage === totalPages}
                      onClick={() => goToPage(currentPage + 1)}
                    >
                      Próxima
                      <ChevronRight className="size-4" aria-hidden="true" />
                    </Button>
                  </nav>
                )}
              </>
            )}
        </section>

        <p className="mt-8 text-center text-sm text-muted-foreground">
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
