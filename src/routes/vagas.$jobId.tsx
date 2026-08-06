import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  ExternalLink,
  MapPin,
  BriefcaseBusiness,
} from "lucide-react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { relativeDate } from "@/lib/format";
import { jobsRepository } from "@/services/jobsRepository";
import {
  CONTRACT_LABELS,
  SENIORITY_LABELS,
  SOURCE_LABELS,
  WORKPLACE_LABELS,
} from "@/types/job";

export const Route = createFileRoute("/vagas/$jobId")({
  loader: async ({ params }) => {
    const job = await jobsRepository.getById(params.jobId);
    if (!job) throw notFound();
    return { job };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Vaga indisponível | Radar Vagas" }, { name: "robots", content: "noindex" }],
      };
    }
    const { job } = loaderData;
    const title = `${job.title} — ${job.company} | Radar Vagas`;
    const description = `${job.title} na ${job.company} (${job.locationText}) · ${WORKPLACE_LABELS[job.workplaceType]} · ${SENIORITY_LABELS[job.seniority]}.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: JobDetailPage,
  errorComponent: () => (
    <PageShell>
      <div role="alert" className="rounded-2xl border border-destructive/30 bg-card p-10 text-center">
        <h1 className="text-lg font-bold text-foreground">Não foi possível carregar a vaga</h1>
        <p className="mt-2 text-sm text-muted-foreground">Tente novamente em instantes.</p>
        <Button asChild className="mt-5">
          <Link to="/vagas">Voltar para as vagas</Link>
        </Button>
      </div>
    </PageShell>
  ),
  notFoundComponent: () => (
    <PageShell>
      <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-card">
        <h1 className="text-lg font-bold text-foreground">Vaga não encontrada</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Esta oportunidade pode ter sido encerrada ou removida da plataforma de origem.
        </p>
        <Button asChild className="mt-5">
          <Link to="/vagas">Ver outras vagas</Link>
        </Button>
      </div>
    </PageShell>
  ),
});

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      <SiteFooter />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-2.5 last:border-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-semibold text-foreground">{value}</dd>
    </div>
  );
}

function JobDetailPage() {
  const { job } = Route.useLoaderData();

  return (
    <PageShell>
      <Link
        to="/vagas"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Voltar para as vagas
      </Link>

      <article className="mt-4 rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
        <span className="inline-flex rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand">
          via {SOURCE_LABELS[job.source]}
        </span>
        <h1 className="mt-3 text-2xl font-extrabold leading-tight tracking-tight text-foreground sm:text-3xl">
          {job.title}
        </h1>
        <p className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Building2 className="size-4" aria-hidden="true" />
            {job.company}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-4" aria-hidden="true" />
            {job.locationText}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-4" aria-hidden="true" />
            {relativeDate(job.publishedAt)}
          </span>
        </p>

        <div className="mt-6">
          <Button asChild size="lg">
            <a href={job.applicationUrl} target="_blank" rel="noopener noreferrer">
              Candidatar-se no site da empresa
              <ExternalLink className="size-4" aria-hidden="true" />
            </a>
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            O link abre em uma nova aba, direto na página original da vaga.
          </p>
        </div>

        <div className="mt-8 grid gap-8 md:grid-cols-[1fr_260px]">
          <div>
            <h2 className="text-base font-bold text-foreground">Sobre a vaga</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{job.description}</p>

            <h2 className="mt-6 text-base font-bold text-foreground">Requisitos</h2>
            <ul className="mt-2 space-y-2">
              {job.requirements.map((req) => (
                <li key={req} className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
                  <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-success" />
                  {req}
                </li>
              ))}
            </ul>
          </div>

          <aside className="rounded-xl border border-border bg-secondary/40 p-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <BriefcaseBusiness className="size-4" aria-hidden="true" />
              Resumo
            </h2>
            <dl className="mt-2">
              <InfoRow label="Modalidade" value={WORKPLACE_LABELS[job.workplaceType]} />
              <InfoRow label="Nível" value={SENIORITY_LABELS[job.seniority]} />
              <InfoRow label="Contrato" value={CONTRACT_LABELS[job.contractType]} />
              <InfoRow label="Área" value={job.category} />
              <InfoRow label="Local" value={`${job.city} / ${job.state}`} />
              <InfoRow label="Origem" value={SOURCE_LABELS[job.source]} />
            </dl>
          </aside>
        </div>
      </article>
    </PageShell>
  );
}
