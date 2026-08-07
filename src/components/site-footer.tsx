import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <p className="text-sm font-semibold text-foreground">Radar Vagas</p>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          O Radar Vagas é um projeto independente que organiza oportunidades públicas de emprego
          encontradas em diferentes plataformas de recrutamento. A candidatura acontece sempre na
          página oficial da vaga. Não participamos dos processos seletivos e nunca solicitamos
          pagamento para candidatura.
        </p>

        <nav className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <Link to="/sobre" className="text-muted-foreground hover:text-foreground">
            Sobre
          </Link>

          <Link to="/termos" className="text-muted-foreground hover:text-foreground">
            Termos de Uso
          </Link>

          <Link to="/privacidade" className="text-muted-foreground hover:text-foreground">
            Privacidade
          </Link>

          <a
            href="https://github.com/TeusCarvalho/radar-vagas-hub"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground"
          >
            GitHub
          </a>
        </nav>

        <p className="mt-5 text-xs text-muted-foreground">
          As vagas, marcas e conteúdos pertencem aos seus respectivos titulares.
        </p>

        <p className="mt-3 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Radar Vagas · Hub gratuito de pesquisa de vagas
        </p>
      </div>
    </footer>
  );
}
