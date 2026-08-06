import { Link } from "@tanstack/react-router";
import { Radar } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-surface/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5" aria-label="Radar Vagas — página inicial">
          <span className="flex size-9 items-center justify-center rounded-xl bg-brand text-brand-foreground">
            <Radar className="size-5" aria-hidden="true" />
          </span>
          <span className="text-lg font-extrabold tracking-tight text-foreground">
            Radar<span className="text-brand"> Vagas</span>
          </span>
        </Link>
        <nav aria-label="Navegação principal" className="flex items-center gap-1 text-sm font-semibold">
          <Link
            to="/"
            activeOptions={{ exact: true }}
            activeProps={{ className: "text-brand" }}
            inactiveProps={{ className: "text-muted-foreground hover:text-foreground" }}
            className="rounded-md px-3 py-2 transition-colors"
          >
            Início
          </Link>
          <Link
            to="/vagas"
            activeProps={{ className: "text-brand" }}
            inactiveProps={{ className: "text-muted-foreground hover:text-foreground" }}
            className="rounded-md px-3 py-2 transition-colors"
          >
            Vagas
          </Link>
        </nav>
      </div>
    </header>
  );
}
