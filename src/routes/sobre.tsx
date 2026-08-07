import { createFileRoute, Link } from "@tanstack/react-router";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/sobre")({
  head: () => ({
    meta: [
      { title: "Sobre o projeto | Radar Vagas" },
      {
        name: "description",
        content:
          "Conheça o Radar Vagas, projeto independente que agrega e organiza oportunidades públicas de emprego de diferentes plataformas.",
      },
    ],
  }),
  component: SobrePage,
});

function SobrePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
        <article className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <p className="text-sm font-semibold text-brand">Sobre o projeto</p>

          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground">
            Radar Vagas
          </h1>

          <p className="mt-5 text-base leading-7 text-muted-foreground">
            O Radar Vagas é um projeto independente criado para facilitar a descoberta de
            oportunidades públicas de emprego disponíveis em diferentes plataformas de recrutamento.
          </p>

          <p className="mt-4 text-base leading-7 text-muted-foreground">
            O sistema coleta, normaliza e organiza informações públicas de vagas para permitir
            pesquisa e filtros em um único lugar. A candidatura não acontece no Radar Vagas: o
            usuário é sempre direcionado para a página oficial da oportunidade.
          </p>

          <h2 className="mt-8 text-xl font-bold text-foreground">Fontes integradas</h2>

          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Atualmente o projeto integra oportunidades públicas provenientes de Gupy, InHire,
            Greenhouse, Lever e Ashby.
          </p>

          <h2 className="mt-8 text-xl font-bold text-foreground">Como o catálogo funciona</h2>

          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            O catálogo principal prioriza vagas com data de publicação confiável dentro da janela
            padrão dos últimos 15 dias. Informações como modalidade, senioridade, categoria e tipo
            de contrato são normalizadas para tornar os filtros consistentes.
          </p>

          <h2 className="mt-8 text-xl font-bold text-foreground">Projeto independente</h2>

          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            O Radar Vagas não representa, não é afiliado e não declara parceria oficial com as
            empresas ou plataformas cujas oportunidades são referenciadas. Marcas, nomes e conteúdos
            pertencem aos seus respectivos titulares.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/vagas">Explorar vagas</Link>
            </Button>

            <Button asChild variant="outline">
              <a
                href="https://github.com/TeusCarvalho/radar-vagas-hub"
                target="_blank"
                rel="noopener noreferrer"
              >
                Ver projeto no GitHub
              </a>
            </Button>
          </div>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
