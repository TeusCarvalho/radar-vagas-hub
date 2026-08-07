import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import {
  ArrowLeft,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ExternalLink,
  MapPin,
} from "lucide-react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { relativeDate } from "@/lib/format";
import { jobsRepository } from "@/services/jobsRepository";

import { CONTRACT_LABELS, SENIORITY_LABELS, SOURCE_LABELS, WORKPLACE_LABELS } from "@/types/job";

import type { Job } from "@/types/job";

export const Route = createFileRoute("/vagas_/$jobId")({
  loader: async ({ params }): Promise<{ job: Job }> => {
    const job = await jobsRepository.getById(params.jobId);

    if (!job) {
      throw notFound();
    }

    return { job };
  },

  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          {
            title: "Vaga indisponível | Radar Vagas",
          },
          {
            name: "robots",
            content: "noindex",
          },
        ],
      };
    }

    const { job } = loaderData;

    const title = `${job.title} — ${job.company} | Radar Vagas`;

    const description = `${job.title} na ${job.company} (${job.locationText}) · ${WORKPLACE_LABELS[job.workplaceType]} · ${SENIORITY_LABELS[job.seniority]}.`;

    return {
      meta: [
        {
          title,
        },
        {
          name: "description",
          content: description,
        },
        {
          property: "og:title",
          content: title,
        },
        {
          property: "og:description",
          content: description,
        },
      ],
    };
  },

  component: JobDetailPage,

  errorComponent: () => (
    <PageShell>
      <main className="mx-auto w-full max-w-4xl px-4 py-16 sm:px-6">
        <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-card">
          <h1 className="text-xl font-bold text-foreground">Não foi possível carregar a vaga</h1>

          <p className="mt-2 text-sm text-muted-foreground">Tente novamente em instantes.</p>

          <Button asChild className="mt-6">
            <Link to="/vagas">Voltar para as vagas</Link>
          </Button>
        </div>
      </main>
    </PageShell>
  ),

  notFoundComponent: () => (
    <PageShell>
      <main className="mx-auto w-full max-w-4xl px-4 py-16 sm:px-6">
        <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-card">
          <h1 className="text-xl font-bold text-foreground">Vaga não encontrada</h1>

          <p className="mt-2 text-sm text-muted-foreground">
            Esta oportunidade pode ter sido encerrada ou removida da plataforma de origem.
          </p>

          <Button asChild className="mt-6">
            <Link to="/vagas">Ver outras vagas</Link>
          </Button>
        </div>
      </main>
    </PageShell>
  ),
});

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      {children}

      <SiteFooter />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-border py-3 last:border-b-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>

      <dd className="mt-1 text-sm font-semibold text-foreground">{value}</dd>
    </div>
  );
}

function formatDeadline(value?: string | null) {
  if (!value) {
    return "Não informado";
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);

  if (match) {
    const [, year, month, day] = match;

    return `${day}/${month}/${year}`;
  }

  return value;
}

function JobDetailPage() {
  const { job } = Route.useLoaderData() as {
    job: Job;
  };

  const skills = job.skills ?? [];

  return (
    <PageShell>
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <Link
          to="/vagas"
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
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

          <p className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
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

          <div className="mt-8 grid gap-8 md:grid-cols-[minmax(0,1fr)_280px]">
            <div className="min-w-0">
              <section>
                <h2 className="text-lg font-bold text-foreground">Sobre a vaga</h2>

                <div className="mt-3 whitespace-pre-line text-sm leading-7 text-muted-foreground">
                  {job.description}
                </div>
              </section>

              {skills.length > 0 && (
                <section className="mt-8">
                  <h2 className="text-lg font-bold text-foreground">Competências</h2>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {skills.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-full border border-border bg-secondary px-3 py-1.5 text-xs font-semibold text-foreground"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              <section className="mt-8 rounded-xl border border-border bg-secondary/30 p-4">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  As informações desta vaga são obtidas da plataforma de origem. Consulte sempre o
                  anúncio original antes de concluir sua candidatura.
                </p>
              </section>
            </div>

            <aside className="h-fit rounded-xl border border-border bg-secondary/40 p-4">
              <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
                <BriefcaseBusiness className="size-4" aria-hidden="true" />
                Resumo
              </h2>

              <dl className="mt-2">
                <InfoRow label="Modalidade" value={WORKPLACE_LABELS[job.workplaceType]} />

                <InfoRow label="Nível" value={SENIORITY_LABELS[job.seniority]} />

                <InfoRow label="Contrato" value={CONTRACT_LABELS[job.contractType]} />

                <InfoRow label="Categoria" value={job.category} />

                <InfoRow label="Local" value={job.locationText} />

                <InfoRow label="País" value={job.country || "Não informado"} />

                <InfoRow
                  label="Prazo para candidatura"
                  value={formatDeadline(job.applicationDeadline)}
                />

                <InfoRow label="Fonte" value={SOURCE_LABELS[job.source]} />
              </dl>
            </aside>
          </div>
        </article>
      </main>
    </PageShell>
  );
}
