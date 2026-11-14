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
    <span className={`rounded-md px-2.5 py-1 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

function getDeadlineInfo(value?: string | null) {
  if (!value) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return { date: value, message: null };

  const [, year, month, day] = match;
  const deadline = new Date(Number(year), Number(month) - 1, Number(day));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  deadline.setHours(0, 0, 0, 0);

  const days = Math.ceil((deadline.getTime() - today.getTime()) / 86_400_000);
  let message: string | null = null;

  if (days === 0) message = "Encerra hoje";
  else if (days === 1) message = "Encerra amanhã";
  else if (days > 1 && days <= 7) message = `Encerra em ${days} dias`;

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
  const skills = (job.skills ?? []).filter(Boolean).slice(0, 3);

  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-card transition-colors hover:border-brand/50 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-bold leading-snug text-foreground sm:text-lg">
            {isLocalPreview ? (
              <a
                href={job.applicationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-brand focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                {job.title}
              </a>
            ) : (
              <Link
                to="/vagas/$jobId"
                params={{ jobId: job.id }}
                className="hover:text-brand focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                {job.title}
              </Link>
            )}
          </h2>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <Building2 className="size-4 shrink-0" aria-hidden="true" />
              <span
                className="break-words"
                title={
                  job.source === "infojobs" && job.company === "Empresa confidencial"
                    ? "Nome da empresa não identificado na fonte InfoJobs"
                    : undefined
                }
              >
                {job.company}
              </span>
            </span>
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <MapPin className="size-4 shrink-0" aria-hidden="true" />
              <span className="break-words">{job.locationText}</span>
            </span>
          </div>
        </div>

        <div className="shrink-0 text-xs text-muted-foreground sm:text-right">
          <p>{relativeDate(job.publishedAt)}</p>
          {deadline && (
            <p className="mt-1 inline-flex items-center gap-1">
              <CalendarDays className="size-3.5" aria-hidden="true" />
              Inscrições até {deadline.date}
            </p>
          )}
          {deadline?.message && <p className="mt-1 font-semibold text-brand">{deadline.message}</p>}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Chip tone={job.workplaceType === "remote" ? "success" : "brand"}>
          {WORKPLACE_LABELS[job.workplaceType]}
        </Chip>
        {job.seniority !== "nao_informado" && (
          <Chip>{SENIORITY_LABELS[job.seniority]}</Chip>
        )}
        {job.contractType !== "nao_informado" && (
          <Chip>{CONTRACT_LABELS[job.contractType]}</Chip>
        )}
        {job.category && job.category !== "Outros" && (
          <Chip>{job.category}</Chip>
        )}
      </div>

      {skills.length > 0 && (
        <p className="mt-3 line-clamp-1 text-xs text-muted-foreground">
          <span className="font-semibold">Competências:</span> {skills.join(" · ")}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <span className="text-xs text-muted-foreground">
          Fonte: {SOURCE_LABELS[job.source]}
        </span>
        <Button asChild size="sm">
          {isLocalPreview ? (
            <a href={job.applicationUrl} target="_blank" rel="noopener noreferrer">
              Ver vaga original
              <ArrowUpRight className="ml-1 size-4" aria-hidden="true" />
            </a>
          ) : (
            <Link to="/vagas/$jobId" params={{ jobId: job.id }}>
              Ver detalhes
              <ArrowUpRight className="ml-1 size-4" aria-hidden="true" />
            </Link>
          )}
        </Button>
      </div>
    </article>
  );
}
