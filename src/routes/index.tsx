import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Radar, Building2, ShieldCheck, Filter } from "lucide-react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { jobsSeed } from "@/data/jobs";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Radar Vagas — busque vagas de emprego em um só lugar" },
      {
        name: "description",
        content:
          "O Radar Vagas reúne oportunidades de várias empresas publicadas na Gupy e InHire. Pesquise por cargo, empresa ou palavra-chave e candidate-se no site original.",
      },
      { property: "og:title", content: "Radar Vagas — vagas de várias empresas em um só lugar" },
      {
        property: "og:description",
        content: "Pesquise vagas por cargo, empresa, modalidade e senioridade. Candidatura no site original.",
      },
    ],
  }),
  component: Index,
});

const highlights = [
  {
    icon: Building2,
    title: "Várias empresas reunidas",
    text: "Oportunidades de diferentes companhias agregadas em uma única lista organizada.",
  },
  {
    icon: Filter,
    title: "Filtros que fazem sentido",
    text: "Modalidade, senioridade, estado, área, contrato e plataforma de origem.",
  },
  {
    icon: ShieldCheck,
    title: "Candidatura na fonte",
    text: "Você é levado direto ao anúncio original da empresa para se candidatar com segurança.",
  },
];

function Index() {
  const navigate = useNavigate();
  const [term, setTerm] = useState("");

  const categories = [...new Set(jobsSeed.map((j) => j.category))].sort();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    navigate({ to: "/vagas", search: { q: term.trim() } });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main className="flex-1">
        <section className="border-b border-border bg-surface">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
              <Radar className="size-3.5" aria-hidden="true" />
              Hub de pesquisa de vagas
            </span>
            <h1 className="mt-5 max-w-3xl text-3xl font-extrabold leading-[1.1] tracking-tight text-foreground sm:text-5xl">
              Encontre oportunidades em várias empresas em um só lugar
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
              Pesquise por cargo, palavra-chave ou empresa, filtre pelo que importa e candidate-se
              diretamente no site da companhia.
            </p>

            <form
              onSubmit={handleSubmit}
              role="search"
              className="mt-8 flex w-full max-w-2xl flex-col gap-3 sm:flex-row"
            >
              <div className="relative flex-1">
                <Label htmlFor="busca-home" className="sr-only">
                  Buscar vagas por cargo, palavra-chave ou empresa
                </Label>
                <Search
                  className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="busca-home"
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder="Ex.: desenvolvedor, analista, designer…"
                  className="h-14 rounded-xl bg-surface pl-11 text-base shadow-card"
                />
              </div>
              <Button type="submit" size="lg" className="h-14 rounded-xl px-8 text-base">
                Buscar vagas
              </Button>
            </form>

            <div className="mt-6 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Áreas em alta:</span>
              {categories.slice(0, 5).map((category) => (
                <Link
                  key={category}
                  to="/vagas"
                  search={{ area: category }}
                  className="rounded-full border border-border bg-surface px-3 py-1 font-medium text-foreground transition-colors hover:border-brand hover:text-brand"
                >
                  {category}
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-xl font-bold tracking-tight text-foreground">Como o Radar Vagas ajuda</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {highlights.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-2xl border border-border bg-card p-6 shadow-card">
                <span className="flex size-10 items-center justify-center rounded-xl bg-success-soft text-accent-foreground">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-base font-bold text-foreground">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-6 shadow-card">
            <p className="text-sm font-semibold text-foreground">
              {jobsSeed.length} vagas disponíveis agora no radar
            </p>
            <Button asChild variant="outline">
              <Link to="/vagas">Ver todas as vagas</Link>
            </Button>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
