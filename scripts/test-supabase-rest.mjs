import { readFileSync } from "node:fs";

function loadLocalEnv(filePath) {
  const content = readFileSync(filePath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

async function main() {
  loadLocalEnv(".env.collector.local");

  const baseUrl = process.env.SUPABASE_URL
    ?.trim()
    .replace(/\/+$/, "");

  const secretKey =
    process.env.SUPABASE_SECRET_KEY?.trim();

  if (!baseUrl) {
    throw new Error("SUPABASE_URL não configurada.");
  }

  if (!secretKey?.startsWith("sb_secret_")) {
    throw new Error("SUPABASE_SECRET_KEY inválida.");
  }

  const endpoint =
    `${baseUrl}/rest/v1/jobs?select=id,source,external_id,title&limit=1`;

  console.log("Testando REST API...");
  console.log(`Host: ${new URL(endpoint).host}`);
  console.log(`Path: ${new URL(endpoint).pathname}`);

  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      apikey: secretKey,
      Authorization: `Bearer ${secretKey}`,
      Accept: "application/json",
    },
  });

  console.log(`Status HTTP: ${response.status}`);

  const body = await response.text();

  if (!response.ok) {
    console.log("Resposta da API:");
    console.log(body);

    throw new Error(
      `REST API retornou HTTP ${response.status}`,
    );
  }

  console.log("✅ REST API respondeu corretamente.");

  const data = body ? JSON.parse(body) : [];

  console.log(`Registros retornados: ${data.length}`);

  if (data.length === 0) {
    console.log("✅ A tabela jobs continua vazia.");
  } else {
    console.table(data);
  }

  console.log("Nenhum dado foi alterado.");
}

main().catch((error) => {
  console.error(
    "\n❌ ERRO:",
    error instanceof Error ? error.message : error,
  );

  process.exitCode = 1;
});