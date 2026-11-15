// Teste leve, somente leitura, do Worker em produção.
// Não realiza carga, não acessa credenciais e não envia dados ao Supabase.
const BASE_URL = "https://teuscarvalho-radar-vagas-hub.teuscarvalho.workers.dev";
const paths = [
  "/",
  "/vagas",
  "/vagas?q=Analista%20de%20Dados&modalidade=remote&pagina=1",
];

let failed = false;
for (const path of paths) {
  const start = performance.now();
  try {
    const response = await fetch(new URL(path, BASE_URL), {
      method: "GET",
      headers: { Accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const elapsed = Math.round(performance.now() - start);
    const contentType = response.headers.get("content-type") ?? "";
    const html = await response.text();
    const finalUrl = new URL(response.url);

    const problems = [];
    if (response.status !== 200) problems.push(`HTTP ${response.status}`);
    if (finalUrl.origin !== BASE_URL) problems.push("redirecionamento externo inesperado");
    if (!contentType.includes("text/html")) problems.push(`content-type inesperado: ${contentType}`);
    if (!/radar\s+vagas/i.test(html)) problems.push("marca Radar Vagas ausente no HTML");
    if (/Just a moment\.\.\.|Checking your browser before accessing|Error 1020/i.test(html)) {
      problems.push("página de bloqueio/challenge recebida em lugar do aplicativo");
    }

    if (problems.length) {
      failed = true;
      console.error(`FALHOU ${path} | ${elapsed}ms | ${problems.join("; ")}`);
    } else {
      console.log(`OK ${path} | HTTP 200 | ${elapsed}ms | ${html.length} caracteres`);
    }
    if (path === "/") {
      const names = ["content-security-policy", "x-content-type-options", "referrer-policy", "strict-transport-security"];
      const summary = Object.fromEntries(names.map(name => [name, response.headers.has(name)]));
      console.log("Headers defensivos observados (diagnóstico, não reprovação):", JSON.stringify(summary));
    }
  } catch (error) {
    failed = true;
    console.error(`FALHOU ${path}:`, error instanceof Error ? error.message : String(error));
  }
}
if (failed) process.exitCode = 1;
