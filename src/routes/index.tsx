import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, Clock3, Search, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { useState, type FormEvent } from "react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Radar Vagas — encontre vagas recentes" },
      {
        name: "description",
        content:
          "Pesquise vagas publicadas nos últimos 7 dias em Gupy, InHire, Greenhouse, Lever, Ashby e InfoJobs. Filtre e candidate-se na página original.",
      },
      { property: "og:title", content: "Radar Vagas — encontre vagas recentes" },
      {
        property: "og:description",
        content: "Busque oportunidades recentes em seis plataformas e acesse a candidatura na fonte.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
  const [term, setTerm] = useState("");

  const goToJobs = (modalidade = "todos") => {
    navigate({
      to: "/vagas",
      search: {
        q: term.trim(),
        modalidade,
        nivel: "todos",
        estado: "todos",
        area: "todos",
        contrato: "todos",
        origem: "todos",
        ordem: "recentes",
        pagina: 1,
        previa: "",
      },
    });
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    goToJobs();
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main className="flex-1">
        <section className="border-b border-border bg-card">
          <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-wider text-brand">
                Vagas publicadas nos últimos 7 dias
              </p>
              <h1 className="mt-3 max-w-2xl text-3xl font-extrabold leading-tight tracking-tight text-foreground sm:text-5xl">
                Encontre sua próxima oportunidade.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                Busque cargo, empresa ou área em seis plataformas. Compare os resultados e vá
                diretamente ao anúncio original para se candidatar.
              </p>

              <form
                onSubmit={submitSearch}
                role="search"
                className="mt-7 flex flex-col gap-2 sm:flex-row"
              >
                <div className="relative min-w-0 flex-1">
                  <Label htmlFor="busca-home" className="sr-only">
                    Cargo, empresa ou palavra-chave
                  </Label>
                  <Search
                    className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    id="busca-home"
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

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="mr-1 text-xs font-medium text-muted-foreground">
                  Busca rápida:
                </span>
                <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={() => goToJobs("remote")}>
                  Remotas
                </Button>
                <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={() => goToJobs("hybrid")}>
                  Híbridas
                </Button>
                <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={() => goToJobs("onsite")}>
                  Presenciais
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => goToJobs()}>
                  Ver todas
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section
          className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6"
          aria-label="Como funciona o Radar Vagas"
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex items-start gap-3">
              <Clock3 className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-foreground">Foco em vagas recentes</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Publicações dos últimos sete dias, sujeitas à disponibilidade na fonte.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <SlidersHorizontal className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-foreground">Filtros objetivos</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Modalidade, nível, estado, área e plataforma.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-foreground">Candidatura na origem</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  O Radar é independente e não recebe candidaturas.
                </p>
              </div>
            </div>
          </div>

          <p className="mt-8 border-t border-border pt-5 text-center text-xs text-muted-foreground">
            Fontes: Gupy · InHire · Greenhouse · Lever · Ashby · InfoJobs
          </p>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
