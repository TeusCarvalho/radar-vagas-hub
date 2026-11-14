import { Link } from "@tanstack/react-router";
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
  emphasized = false,
}: {
  children: React.ReactNode;
  emphasized?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ${
        emphasized ? "bg-brand-soft text-brand" : "bg-secondary text-secondary-foreground"
      }`}
    >
      {children}
    </span>
  );
}

function getDeadlineInfo(value?: string | null) {
  if (!value) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const remaining = Math.round((date.getTime() - today.getTime()) / 86_400_000);

  if (remaining < 0) return null;
  return remaining === 0
    ? "Inscrições até hoje"
    : remaining <= 7
      ? `Inscrições até ${day}/${month}`
      : null;
}

function safeApplicationUrl(value: string): string | null {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

export function JobCard({
  job,
  isLocalPreview = false,
}: {
  job: Job;
  isLocalPreview?: boolean;
}) {
  const safeUrl = safeApplicationUrl(job.applicationUrl);
  const deadline = getDeadlineInfo(job.applicationDeadline);

  return (
    <article className="rounded-xl border border-border bg-card px-4 py-4 transition-colors hover:border-brand/40 hover:bg-card/95 sm:px-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold leading-snug text-foreground sm:text-lg">
            {isLocalPreview && safeUrl ? (
              <a
                href={safeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-brand focus-visible:rounded focus-visible:outline-2 focus-visible:outline-brand"
              >
                {job.title}
              </a>
            ) : (
              <Link
                to="/vagas/$jobId"
                params={{ jobId: job.id }}
                className="hover:text-brand focus-visible:rounded focus-visible:outline-2 focus-visible:outline-brand"
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
                title={job.source === "infojobs" && job.company === "Empresa confidencial"
                  ? "Empresa não identificada na fonte InfoJobs"
                  : undefined}
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
        <p className="shrink-0 whitespace-nowrap text-xs text-muted-foreground sm:pt-1">
          {relativeDate(job.publishedAt)}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Chip emphasized={job.workplaceType === "remote"}>
          {WORKPLACE_LABELS[job.workplaceType]}
        </Chip>
        {job.seniority !== "nao_informado" && (
          <Chip>{SENIORITY_LABELS[job.seniority]}</Chip>
        )}
        {job.contractType !== "nao_informado" && (
          <Chip>{CONTRACT_LABELS[job.contractType]}</Chip>
        )}
        {job.category && job.category !== "Outros" && job.category !== "Outras áreas" && (
          <Chip>{job.category}</Chip>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>Fonte: {SOURCE_LABELS[job.source]}</span>
          {deadline && (
            <span className="inline-flex items-center gap-1 text-brand">
              <CalendarDays className="size-3.5" aria-hidden="true" />
              {deadline}
            </span>
          )}
        </div>
        {safeUrl ? (
          <Button asChild size="sm" className="max-sm:w-full">
            <a href={safeUrl} target="_blank" rel="noopener noreferrer">
              Ver vaga original
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </a>
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">Link original indisponível</span>
        )}
      </div>
    </article>
  );
}
