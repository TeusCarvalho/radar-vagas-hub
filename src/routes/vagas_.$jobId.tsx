import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  ExternalLink,
  MapPin,
  BriefcaseBusiness,
  Coins,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { relativeDate } from "@/lib/format";
import { safeJobApplicationUrl } from "@/lib/job-url";
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
          { title: "Vaga indisponível | Radar Vagas" },
          { name: "robots", content: "noindex" },
        ],
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
      <div
        role="alert"
        className="rounded-2xl border border-destructive/30 bg-card p-10 text-center"
      >
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

function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      <SiteFooter />
    </div>
  );
}

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden={true} />
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-sm text-foreground">{value}</p>
      </div>
    </div>
  );
}

function formatSalary(job: Job): string | null {
  if (job.salaryDescription?.trim()) {
    return job.salaryDescription.trim();
  }

  if (job.salaryMin == null && job.salaryMax == null) {
    return null;
  }

  const currency = job.salaryCurrency || "BRL";

  const normalizedCurrency = /^[A-Z]{3}$/.test(currency.toUpperCase())
    ? currency.toUpperCase()
    : "BRL";

  const formatter = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: normalizedCurrency,
    maximumFractionDigits: 0,
  });

  if (job.salaryMin != null && job.salaryMax != null) {
    return `${formatter.format(job.salaryMin)} – ${formatter.format(job.salaryMax)}`;
  }

  const value = job.salaryMin ?? job.salaryMax;

  return value == null ? null : formatter.format(value);
}

function JobDetailPage() {
  const { job } = Route.useLoaderData();
  const salary = formatSalary(job);
  const safeUrl = safeJobApplicationUrl(job.applicationUrl);

  return (
    <PageShell>
      <Button asChild variant="ghost" className="-ml-3 mb-5">
        <Link to="/vagas">
          <ArrowLeft className="mr-2 size-4" aria-hidden="true" />
          Voltar para as vagas
        </Link>
      </Button>

      <article className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-brand">{SOURCE_LABELS[job.source]}</p>

            <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
              {job.title}
            </h1>

            <p className="mt-2 text-base font-medium text-foreground">{job.company}</p>
          </div>

          {safeUrl && (
            <Button asChild>
              <a href={safeUrl} target="_blank" rel="noopener noreferrer">
                Ver vaga original
                <ExternalLink className="ml-2 size-4" aria-hidden="true" />
              </a>
            </Button>
          )}
        </div>

        <div className="mt-8 grid gap-5 border-t border-border pt-6 sm:grid-cols-2">
          <InfoItem icon={Building2} label="Empresa" value={job.company} />

          <InfoItem icon={MapPin} label="Localização" value={job.locationText} />

          <InfoItem
            icon={BriefcaseBusiness}
            label="Modalidade"
            value={WORKPLACE_LABELS[job.workplaceType]}
          />

          <InfoItem
            icon={BriefcaseBusiness}
            label="Senioridade"
            value={SENIORITY_LABELS[job.seniority]}
          />

          <InfoItem
            icon={BriefcaseBusiness}
            label="Contrato"
            value={CONTRACT_LABELS[job.contractType]}
          />

          <InfoItem icon={CalendarDays} label="Publicação" value={relativeDate(job.publishedAt)} />

          {salary && <InfoItem icon={Coins} label="Remuneração" value={salary} />}
        </div>

        <div className="mt-8 border-t border-border pt-6">
          <h2 className="text-lg font-bold text-foreground">Sobre esta oportunidade</h2>

          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Consulte a descrição completa, os requisitos, benefícios e demais condições diretamente
            na página oficial da vaga.
          </p>

          {job.skills && job.skills.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-foreground">
                Tecnologias e competências identificadas
              </h3>

              <div className="mt-3 flex flex-wrap gap-2">
                {job.skills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 rounded-xl border border-border bg-background p-4">
          <p className="text-xs leading-5 text-muted-foreground">
            O Radar Vagas é um projeto independente e não participa do processo seletivo. A
            candidatura e todas as informações oficiais da oportunidade são de responsabilidade da
            empresa e da plataforma de origem.
          </p>
        </div>

        <div className="mt-6">
          {safeUrl ? (
            <Button asChild>
              <a href={safeUrl} target="_blank" rel="noopener noreferrer">
                Acessar página oficial da vaga
                <ExternalLink className="ml-2 size-4" aria-hidden="true" />
              </a>
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              O link original desta vaga está indisponível.
            </p>
          )}
        </div>
      </article>
    </PageShell>
  );
}
