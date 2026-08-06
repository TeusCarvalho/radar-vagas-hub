import { Link } from "@tanstack/react-router";
import { Building2, MapPin, ArrowUpRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { relativeDate } from "@/lib/format";
import {
  CONTRACT_LABELS,
  SENIORITY_LABELS,
  SOURCE_LABELS,
  WORKPLACE_LABELS,
  type Job,
} from "@/types/job";

function Chip({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "brand" | "success" }) {
  const tones = {
    neutral: "bg-secondary text-secondary-foreground",
    brand: "bg-brand-soft text-brand",
    success: "bg-success-soft text-accent-foreground",
  } as const;
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>
  );
}

export function JobCard({ job }: { job: Job }) {
  return (
    <article className="group rounded-2xl border border-border bg-card p-5 shadow-card transition-shadow hover:shadow-card-hover">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-bold leading-snug text-foreground sm:text-lg">
            <Link to="/vagas/$jobId" params={{ jobId: job.id }} className="hover:text-brand">
              {job.title}
            </Link>
          </h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Building2 className="size-4" aria-hidden="true" />
              {job.company}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4" aria-hidden="true" />
              {job.locationText}
            </span>
          </p>
        </div>
        <span className="text-xs font-medium text-muted-foreground">{relativeDate(job.publishedAt)}</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Chip tone={job.workplaceType === "remoto" ? "success" : "brand"}>
          {WORKPLACE_LABELS[job.workplaceType]}
        </Chip>
        <Chip>{SENIORITY_LABELS[job.seniority]}</Chip>
        <Chip>{CONTRACT_LABELS[job.contractType]}</Chip>
        <Chip>{job.category}</Chip>
        <Chip>via {SOURCE_LABELS[job.source]}</Chip>
      </div>

      <p className="mt-4 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{job.description}</p>

      <div className="mt-5">
        <Button asChild size="sm">
          <Link to="/vagas/$jobId" params={{ jobId: job.id }}>
            Ver vaga
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </article>
  );
}
