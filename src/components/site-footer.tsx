export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border bg-surface">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <p className="text-sm font-semibold text-foreground">Radar Vagas</p>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          O Radar Vagas apenas agrega oportunidades publicadas em plataformas de recrutamento como Gupy e
          InHire. Não somos responsáveis pelos processos seletivos: a candidatura acontece sempre no site
          original da empresa. Nunca solicitamos pagamento para candidatura.
        </p>
        <p className="mt-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Radar Vagas · Hub de pesquisa de vagas
        </p>
      </div>
    </footer>
  );
}
