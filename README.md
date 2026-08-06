# Radar de Vagas

Crie um MVP público chamado “Radar Vagas”, em português do Brasil, para funcionar como hub de pesquisa de vagas de emprego. O produto deve ter visual profissional, moderno, confiável e responsivo, sem aparência de template genérico. Use React + TypeScript + Tailwind + shadcn/ui.

Objetivo: qualquer pessoa deve conseguir acessar o site, pesquisar vagas e ser redirecionada ao anúncio original para se candidatar. A futura fonte de dados será um coletor de vagas da Gupy e InHire, portanto deixe a arquitetura preparada para Supabase/PostgreSQL e integração por API.

Páginas e funcionalidades do MVP:
1. Página inicial com cabeçalho, marca Radar Vagas, texto curto “Encontre oportunidades em várias empresas em um só lugar”, campo de busca principal e CTA “Buscar vagas”.
2. Página/listagem de vagas com pesquisa por cargo, palavra-chave ou empresa.
3. Filtros: modalidade (remoto, híbrido, presencial), senioridade (estágio, júnior, pleno, sênior, especialista), estado/localidade, área profissional, tipo de contrato e plataforma de origem (Gupy ou InHire).
4. Ordenação por mais recentes e relevância.
5. Cards contendo cargo, empresa, localidade, modalidade, nível, tipo de contrato, origem, data relativa e botão “Ver vaga”.
6. Página de detalhes da vaga com descrição, requisitos, informações resumidas e botão destacado “Candidatar-se no site da empresa”, abrindo o link original em nova aba.
7. Estados de carregamento, vazio e erro.
8. Layout mobile-first, acessível e com SEO básico.
9. Rodapé com aviso de que o Radar Vagas agrega oportunidades e que a candidatura ocorre no site original.
10. Criar uma pequena base de dados demonstrativa local com pelo menos 18 vagas variadas para que todos os filtros funcionem imediatamente.

Estrutura de dados de cada vaga: id, source, externalId, title, company, companyLogo opcional, description, requirements, city, state, locationText, workplaceType, contractType, seniority, category, applicationUrl, publishedAt, firstSeenAt, lastSeenAt, active.

Design:
- Fundo claro e limpo.
- Cor principal azul-petróleo ou azul profundo com acento verde discreto.
- Tipografia forte, bom espaçamento e cards elegantes.
- Evite excesso de gradientes.
- Inclua chips visuais para remoto, nível e contrato.
- Inclua contador de resultados e botão para limpar filtros.

Arquitetura:
- Separe componentes, páginas, tipos, dados e serviços.
- Use React Router.
- Crie um serviço/repositório de vagas que hoje lê dados locais, mas cuja interface possa depois ser substituída por Supabase sem alterar as páginas.
- Use parâmetros da URL para persistir busca e filtros.
- Não implemente login neste MVP.

Entregue o site navegável e sem erros de TypeScript.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://radar-vagas-hub.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/310c1a03-7316-45ae-b593-838eb4f37601).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
