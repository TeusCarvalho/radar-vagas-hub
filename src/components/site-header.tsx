import { Link } from "@tanstack/react-router";
import { Radar } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          to="/"
          className="flex items-center gap-2.5"
          aria-label="Radar Vagas — página inicial"
        >
          <span className="flex size-9 items-center justify-center rounded-xl bg-brand text-brand-foreground">
            <Radar className="size-5" aria-hidden="true" />
          </span>

          <span className="text-base font-extrabold tracking-tight text-foreground">
            Radar
            <span className="text-brand"> Vagas</span>
          </span>
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          <nav className="flex items-center text-sm font-semibold" aria-label="Navegação principal">
            <Link
              to="/"
              activeOptions={{ exact: true }}
              activeProps={{
                className: "text-brand",
              }}
              inactiveProps={{
                className: "text-muted-foreground hover:text-foreground",
              }}
              className="rounded-md px-2 py-2 transition-colors sm:px-3"
            >
              Início
            </Link>

            <Link
              to="/vagas"
              activeProps={{
                className: "text-brand",
              }}
              inactiveProps={{
                className: "text-muted-foreground hover:text-foreground",
              }}
              className="rounded-md px-2 py-2 transition-colors sm:px-3"
            >
              Vagas
            </Link>
          </nav>

          <div className="ml-1 border-l border-border pl-2">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
