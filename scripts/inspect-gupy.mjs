const BASE_URL = "https://employability-portal.gupy.io/api/v1/jobs";

async function main() {
  const url = new URL(BASE_URL);

  url.searchParams.set("jobName", "Analista de Dados");
  url.searchParams.set("offset", "0");
  url.searchParams.set("limit", "1");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Radar-Vagas/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Gupy respondeu ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  const jobs = Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data?.results)
      ? data.results
      : [];

  if (jobs.length === 0) {
    console.log("Nenhuma vaga encontrada.");
    return;
  }

  console.log("\nCampos disponíveis:");
  console.log(Object.keys(jobs[0]).sort());

  console.log("\nObjeto completo da primeira vaga:");
  console.dir(jobs[0], {
    depth: null,
    colors: true,
  });
}

main().catch((error) => {
  console.error("Erro:", error);
  process.exitCode = 1;
});
