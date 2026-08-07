import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search, Building2, SlidersHorizontal, ExternalLink } from "lucide-react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { jobsRepository } from "@/services/jobsRepository";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "Radar Vagas — busque vagas de emprego em um só lugar",
      },
      {
        name: "description",
        content:
          "O Radar Vagas reúne oportunidades de várias empresas publicadas na Gupy e InHire. Pesquise por cargo, empresa ou palavra-chave.",
      },
      {
        property: "og:title",
        content: "Radar Vagas — vagas de várias empresas em um só lugar",
      },
      {
        property: "og:description",
        content:
          "Pesquise vagas por cargo, empresa, modalidade e senioridade. Candidatura no site original.",
      },
    ],
  }),

  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
  const [term, setTerm] = useState("");

  /*
   * Busca a quantidade real de vagas disponíveis.
   * Os dados vêm do Supabase através do jobsRepository.
   */
  const { data: jobsData, isPending: isJobsPending } = useQuery({
    queryKey: ["home-jobs-count"],
    queryFn: () =>
      jobsRepository.search({
        q: "",
        sort: "recentes",
      }),
  });

  /*
   * Busca as categorias reais cadastradas no Supabase.
   */
  const { data: facets } = useQuery({
    queryKey: ["jobs-facets"],
    queryFn: () => jobsRepository.listFacets(),
  });

  const categories = facets?.categories ?? [];
  const totalJobs = jobsData?.total ?? 0;

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();

    navigate({
      to: "/vagas",
      search: {
        q: term.trim(),
      },
    });
  };

  const searchCategory = (category: string) => {
    navigate({
      to: "/vagas",
      search: {
        area: category,
      },
    });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-border bg-surface">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-semibold uppercase tracking-wide text-brand">
                Hub de pesquisa de vagas
              </p>

              <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl">
                Encontre oportunidades em várias empresas em um só lugar
              </h1>

              <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                Pesquise vagas publicadas em plataformas como Gupy e InHire, filtre as oportunidades
                e faça sua candidatura diretamente no site original da empresa.
              </p>

              <form
                onSubmit={submitSearch}
                className="mx-auto mt-8 flex max-w-2xl flex-col gap-3 sm:flex-row"
                role="search"
              >
                <div className="relative flex-1">
                  <Label htmlFor="busca-home" className="sr-only">
                    Buscar vagas por cargo, palavra-chave ou empresa
                  </Label>

                  <Search
                    className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />

                  <Input
                    id="busca-home"
                    value={term}
                    onChange={(event) => setTerm(event.target.value)}
                    placeholder="Cargo, palavra-chave ou empresa"
                    className="h-12 bg-background pl-11 text-base"
                  />
                </div>

                <Button type="submit" size="lg" className="h-12">
                  Buscar vagas
                </Button>
              </form>
            </div>
          </div>
        </section>

        {/* Categorias */}
        {categories.length > 0 && (
          <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
            <div className="text-center">
              <h2 className="text-xl font-bold tracking-tight text-foreground">Explore por área</h2>

              <p className="mt-1 text-sm text-muted-foreground">
                Veja oportunidades nas áreas disponíveis no radar.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {categories.slice(0, 10).map((category) => (
                <Button key={category} variant="outline" onClick={() => searchCategory(category)}>
                  {category}
                </Button>
              ))}
            </div>
          </section>
        )}

        {/* Benefícios */}
        <section className="border-y border-border bg-surface">
          <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
            <div className="text-center">
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Como o Radar Vagas ajuda
              </h2>

              <p className="mt-2 text-sm text-muted-foreground">
                Uma busca simples para encontrar oportunidades em diferentes empresas e plataformas.
              </p>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
                <div className="flex size-10 items-center justify-center rounded-xl bg-brand/10">
                  <Search className="size-5 text-brand" aria-hidden="true" />
                </div>

                <h3 className="mt-4 font-bold text-foreground">Pesquisa centralizada</h3>

                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Busque oportunidades por cargo, palavra-chave ou empresa sem precisar pesquisar
                  plataforma por plataforma.
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
                <div className="flex size-10 items-center justify-center rounded-xl bg-brand/10">
                  <SlidersHorizontal className="size-5 text-brand" aria-hidden="true" />
                </div>

                <h3 className="mt-4 font-bold text-foreground">Filtros úteis</h3>

                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Refine a pesquisa por modalidade, senioridade, área, localização, contrato e
                  plataforma de origem.
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
                <div className="flex size-10 items-center justify-center rounded-xl bg-brand/10">
                  <ExternalLink className="size-5 text-brand" aria-hidden="true" />
                </div>

                <h3 className="mt-4 font-bold text-foreground">Candidatura na fonte</h3>

                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Ao encontrar uma oportunidade, você é direcionado para o anúncio original da
                  empresa para realizar a candidatura.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Quantidade de vagas */}
        <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-5 rounded-2xl border border-border bg-card p-6 shadow-card sm:flex-row">
            <div className="flex items-center gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand/10">
                <Building2 className="size-5 text-brand" aria-hidden="true" />
              </div>

              <div>
                <p className="font-bold text-foreground">
                  {isJobsPending
                    ? "Carregando vagas disponíveis..."
                    : `${totalJobs} ${
                        totalJobs === 1 ? "vaga disponível" : "vagas disponíveis"
                      } agora no radar`}
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  Novas oportunidades serão adicionadas automaticamente ao radar.
                </p>
              </div>
            </div>

            <Button asChild>
              <Link to="/vagas">Ver todas as vagas</Link>
            </Button>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
