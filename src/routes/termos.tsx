import { createFileRoute, Link } from "@tanstack/react-router";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso | Radar Vagas" },
      {
        name: "description",
        content:
          "Termos de uso do Radar Vagas, agregador independente de oportunidades públicas de emprego.",
      },
    ],
  }),
  component: TermosPage,
});

function TermosPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
        <article className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <p className="text-sm font-semibold text-brand">Documento institucional</p>

          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground">
            Termos de Uso
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            Última atualização: 7 de agosto de 2026.
          </p>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl font-bold text-foreground">1. Finalidade</h2>

            <p className="text-sm leading-7 text-muted-foreground">
              O Radar Vagas é um agregador independente que organiza referências a oportunidades de
              emprego publicamente disponíveis em plataformas e páginas de recrutamento.
            </p>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl font-bold text-foreground">2. Candidaturas</h2>

            <p className="text-sm leading-7 text-muted-foreground">
              O Radar Vagas não recebe, processa ou decide candidaturas. Ao selecionar uma
              oportunidade, o usuário é direcionado para a página oficial da vaga ou para a
              plataforma de recrutamento responsável.
            </p>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl font-bold text-foreground">3. Informações das vagas</h2>

            <p className="text-sm leading-7 text-muted-foreground">
              As informações exibidas são derivadas de fontes públicas e podem sofrer alterações,
              expirar ou conter divergências em relação ao anúncio original. A página oficial da
              vaga deve ser considerada a referência definitiva para requisitos, benefícios,
              remuneração, prazos e condições.
            </p>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl font-bold text-foreground">4. Responsabilidade</h2>

            <p className="text-sm leading-7 text-muted-foreground">
              O Radar Vagas não garante contratação, participação em processo seletivo ou
              disponibilidade permanente de qualquer oportunidade. Também não participa da relação
              entre candidatos, empresas e plataformas de recrutamento.
            </p>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl font-bold text-foreground">5. Segurança e pagamentos</h2>

            <p className="text-sm leading-7 text-muted-foreground">
              O Radar Vagas não solicita pagamento para visualizar ou acessar oportunidades. Antes
              de fornecer informações pessoais, o usuário deve confirmar que está na página oficial
              da empresa ou da plataforma responsável pela vaga.
            </p>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl font-bold text-foreground">6. Marcas e conteúdos</h2>

            <p className="text-sm leading-7 text-muted-foreground">
              Nomes de empresas, plataformas, marcas e conteúdos de terceiros pertencem aos seus
              respectivos titulares. A presença de uma vaga no Radar Vagas não representa parceria,
              patrocínio ou endosso.
            </p>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl font-bold text-foreground">7. Correção ou remoção</h2>

            <p className="text-sm leading-7 text-muted-foreground">
              Solicitações relacionadas à correção ou remoção de referências podem ser registradas
              no repositório público do projeto no GitHub. Informações suficientes para identificar
              a vaga devem ser fornecidas, sem publicar dados pessoais desnecessários.
            </p>

            <a
              href="https://github.com/TeusCarvalho/radar-vagas-hub/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-brand underline underline-offset-4"
            >
              Abrir solicitação no GitHub
            </a>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl font-bold text-foreground">8. Alterações destes termos</h2>

            <p className="text-sm leading-7 text-muted-foreground">
              Estes termos podem ser atualizados conforme o projeto evoluir. Alterações relevantes
              serão refletidas nesta página.
            </p>
          </section>

          <div className="mt-10">
            <Button asChild>
              <Link to="/vagas">Voltar para as vagas</Link>
            </Button>
          </div>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
