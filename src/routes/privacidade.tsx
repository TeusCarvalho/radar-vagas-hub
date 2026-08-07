import { createFileRoute, Link } from "@tanstack/react-router";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade | Radar Vagas" },
      {
        name: "description",
        content:
          "Política de privacidade do Radar Vagas e informações sobre o tratamento de dados no beta público.",
      },
    ],
  }),
  component: PrivacidadePage,
});

function PrivacidadePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
        <article className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <p className="text-sm font-semibold text-brand">Documento institucional</p>

          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground">
            Política de Privacidade
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            Última atualização: 7 de agosto de 2026.
          </p>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl font-bold text-foreground">1. Escopo do beta</h2>

            <p className="text-sm leading-7 text-muted-foreground">
              Na versão atual, o Radar Vagas funciona como um mecanismo de busca e agregação de
              oportunidades. O site não exige criação de conta para pesquisar vagas e não solicita
              currículo para realizar candidaturas.
            </p>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl font-bold text-foreground">2. Dados das oportunidades</h2>

            <p className="text-sm leading-7 text-muted-foreground">
              O catálogo contém informações profissionais publicamente disponibilizadas nas páginas
              das oportunidades, como cargo, empresa, localização, modalidade, categoria, data de
              publicação e endereço da página oficial da vaga.
            </p>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl font-bold text-foreground">3. Dados técnicos</h2>

            <p className="text-sm leading-7 text-muted-foreground">
              Serviços de hospedagem, infraestrutura e segurança utilizados pelo projeto podem
              processar registros técnicos necessários ao funcionamento do site, como endereço IP,
              horário de acesso, informações do navegador e registros de erro, conforme as políticas
              dos respectivos provedores.
            </p>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl font-bold text-foreground">4. Candidaturas e sites externos</h2>

            <p className="text-sm leading-7 text-muted-foreground">
              Ao acessar uma vaga, o usuário pode ser direcionado para um site externo. A partir
              desse momento, o tratamento de dados pessoais é realizado pela empresa ou plataforma
              responsável, de acordo com suas próprias políticas de privacidade.
            </p>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl font-bold text-foreground">5. Currículos e dados sensíveis</h2>

            <p className="text-sm leading-7 text-muted-foreground">
              O Radar Vagas não precisa receber currículos, documentos pessoais ou informações
              sensíveis para permitir a pesquisa no catálogo. Não publique esse tipo de informação
              em solicitações públicas no GitHub.
            </p>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl font-bold text-foreground">6. Correções e contato</h2>

            <p className="text-sm leading-7 text-muted-foreground">
              Questões relacionadas ao catálogo, correções ou remoções podem ser registradas no
              repositório público do projeto. Evite incluir dados pessoais desnecessários ao abrir
              uma solicitação.
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
            <h2 className="text-xl font-bold text-foreground">7. Evolução do projeto</h2>

            <p className="text-sm leading-7 text-muted-foreground">
              Caso o Radar Vagas passe a oferecer contas, favoritos, alertas, analytics adicionais
              ou outras funcionalidades que alterem o tratamento de dados, esta política deverá ser
              atualizada antes ou junto da disponibilização dessas funcionalidades.
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
