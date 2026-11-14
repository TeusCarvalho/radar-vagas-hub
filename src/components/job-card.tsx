import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { ArrowUpRight, Building2, CalendarDays, MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { relativeDate } from "@/lib/format";

import {
  CONTRACT_LABELS,
  SENIORITY_LABELS,
  SOURCE_LABELS,
  WORKPLACE_LABELS,
  type Job,
} from "@/types/job";

function Chip({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "brand" | "success";
}) {
  const tones = {
    neutral: "bg-secondary text-secondary-foreground",
    brand: "bg-brand-soft text-brand",
    success: "bg-success-soft text-accent-foreground",
  } as const;

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

function getDeadlineInfo(value?: string | null) {
  if (!value) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);

  if (!match) {
    return {
      date: value,
      message: null,
    };
  }

  const [, year, month, day] = match;

  const deadline = new Date(Number(year), Number(month) - 1, Number(day));

  const today = new Date();

  today.setHours(0, 0, 0, 0);
  deadline.setHours(0, 0, 0, 0);

  const diff = deadline.getTime() - today.getTime();

  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  let message: string | null = null;

  if (days === 0) {
    message = "Encerra hoje";
  } else if (days === 1) {
    message = "Encerra amanhã";
  } else if (days > 1 && days <= 7) {
    message = `Encerra em ${days} dias`;
  }

  return {
    date: `${day}/${month}/${year}`,
    message,
  };
}

export function JobCard({
  job,
  isLocalPreview = false,
}: {
  job: Job;
  isLocalPreview?: boolean;
}) {
  const deadline = getDeadlineInfo(job.applicationDeadline);

  const skills = (job.skills ?? []).filter(Boolean).slice(0, 4);

  const showContract = job.contractType !== "nao_informado";

  return (
    <article className="rounded-2xl border border-border bg-card p-5 shadow-card transition-shadow hover:shadow-md sm:p-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <h2 className="text-lg font-bold leading-tight text-foreground">
            {isLocalPreview ? (
              <a
                href={job.applicationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-brand"
              >
                {job.title}
              </a>
            ) : (
              <Link
                to="/vagas/$jobId"
                params={{ jobId: job.id }}
                className="transition-colors hover:text-brand"
              >
                {job.title}
              </Link>
            )}
          </h2>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Building2 className="size-4 shrink-0" aria-hidden="true" />

              <span
                title={
                  job.source === "infojobs" && job.company === "Empresa confidencial"
                    ? "Empresa não identificada no anúncio original do InfoJobs"
                    : undefined
                }
              >
                {job.company}
              </span>
            </span>

            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4 shrink-0" aria-hidden="true" />

              {job.locationText}
            </span>
          </div>
        </div>

        <div className="shrink-0 text-left sm:text-right">
          <p className="text-xs text-muted-foreground">{relativeDate(job.publishedAt)}</p>

          {deadline && (
            <div className="mt-1 text-xs">
              <p className="inline-flex items-center gap-1 font-medium text-muted-foreground">
                <CalendarDays className="size-3.5" aria-hidden="true" />
                Inscrições até {deadline.date}
              </p>

              {deadline.message && (
                <p className="mt-1 font-semibold text-brand">{deadline.message}</p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Chip tone={job.workplaceType === "remote" ? "success" : "brand"}>
          {WORKPLACE_LABELS[job.workplaceType]}
        </Chip>

        <Chip>{SENIORITY_LABELS[job.seniority]}</Chip>

        {showContract && <Chip>{CONTRACT_LABELS[job.contractType]}</Chip>}

        <Chip>{job.category}</Chip>

        <Chip>via {SOURCE_LABELS[job.source]}</Chip>
      </div>

      {skills.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Competências
          </p>

          <p className="mt-1.5 text-sm text-foreground">{skills.join(" · ")}</p>
        </div>
      )}

      <p className="mt-4 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
        {job.description}
      </p>

      <div className="mt-5">
        <Button asChild size="sm">
          {isLocalPreview ? (
            <a href={job.applicationUrl} target="_blank" rel="noopener noreferrer">
              Ver vaga original
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </a>
          ) : (
            <Link to="/vagas/$jobId" params={{ jobId: job.id }}>
              Ver detalhes
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </Link>
          )}
        </Button>
      </div>
    </article>
  );
}
