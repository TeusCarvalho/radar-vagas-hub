import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Search, SlidersHorizontal, ExternalLink, Database } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "Radar Vagas — vagas de emprego em um só lugar",
      },
      {
        name: "description",
        content:
          "Pesquise oportunidades públicas de emprego agregadas de Gupy, InHire, Greenhouse, Lever, Ashby e InfoJobs. O Radar Vagas direciona você para a página oficial da vaga.",
      },
      {
        property: "og:title",
        content: "Radar Vagas — vagas de emprego em um só lugar",
      },
      {
        property: "og:description",
        content:
          "Encontre vagas recentes e candidate-se sempre pela página oficial da oportunidade.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
  const [term, setTerm] = useState("");

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();

    navigate({
      to: "/vagas",
      search: {
        q: term.trim(),
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

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main className="flex-1">
        <section className="border-b border-border">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold text-brand">Hub gratuito de pesquisa de vagas</p>

              <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
                Encontre oportunidades recentes em um só lugar
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                O Radar Vagas organiza oportunidades públicas de diferentes plataformas de
                recrutamento e direciona você para a página oficial da vaga para realizar a
                candidatura.
              </p>

              <form
                onSubmit={submitSearch}
                className="mt-8 flex flex-col gap-3 sm:flex-row"
                role="search"
              >
                <div className="relative flex-1">
                  <Label htmlFor="busca-home" className="sr-only">
                    Buscar vagas
                  </Label>

                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />

                  <Input
                    id="busca-home"
                    value={term}
                    onChange={(event) => setTerm(event.target.value)}
                    placeholder="Cargo, palavra-chave ou empresa"
                    className="pl-9"
                  />
                </div>

                <Button type="submit">Buscar vagas</Button>
              </form>

              <div className="mt-5">
                <Button asChild variant="outline">
                  <Link to="/vagas">Ver todas as vagas</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Como o Radar Vagas ajuda
          </h2>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <article className="rounded-2xl border border-border bg-card p-6">
              <Database className="size-5 text-brand" aria-hidden="true" />
              <h3 className="mt-4 font-semibold text-foreground">Seis fontes integradas</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Gupy, InHire, Greenhouse, Lever, Ashby e InfoJobs em um único catálogo.
              </p>
            </article>

            <article className="rounded-2xl border border-border bg-card p-6">
              <SlidersHorizontal className="size-5 text-brand" aria-hidden="true" />
              <h3 className="mt-4 font-semibold text-foreground">Busca e filtros</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Refine oportunidades por modalidade, senioridade, estado, área, contrato e
                plataforma de origem.
              </p>
            </article>

            <article className="rounded-2xl border border-border bg-card p-6">
              <ExternalLink className="size-5 text-brand" aria-hidden="true" />
              <h3 className="mt-4 font-semibold text-foreground">Candidatura na fonte oficial</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                O Radar não recebe candidaturas. Você sempre é direcionado para a página original da
                oportunidade.
              </p>
            </article>
          </div>

          <div className="mt-8 rounded-2xl border border-border bg-card p-6">
            <p className="font-semibold text-foreground">
              Catálogo focado em oportunidades recentes
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              O catálogo principal mantém vagas com data confiável publicadas dentro da janela
              padrão dos últimos 7 dias.
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
