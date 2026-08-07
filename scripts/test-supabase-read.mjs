import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

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
  console.log("====================================");
  console.log("Radar Vagas - Teste Supabase");
  console.log("MODO SOMENTE LEITURA");
  console.log("====================================");

  loadLocalEnv(".env.collector.local");

  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url) {
    throw new Error("SUPABASE_URL não configurada.");
  }

  if (!secretKey?.startsWith("sb_secret_")) {
    throw new Error("SUPABASE_SECRET_KEY inválida.");
  }

  const supabase = createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  console.log("\nTestando conexão...");

  const { count, error: countError } = await supabase.from("jobs").select("*", {
    count: "exact",
    head: true,
  });

  if (countError) {
    throw new Error(`Falha na conexão: ${countError.message}`);
  }

  console.log("✅ Conexão com Supabase realizada.");
  console.log(`✅ Total de registros na tabela jobs: ${count ?? 0}`);

  if (!count || count === 0) {
    console.log("\nℹ️ A tabela jobs está vazia.");
    console.log("Não há registros para exibir.");

    console.log("\n====================================");
    console.log("TESTE FINALIZADO COM SUCESSO");
    console.log("Nenhum registro foi alterado.");
    console.log("====================================");

    return;
  }

  const { data, error } = await supabase
    .from("jobs")
    .select("id,source,external_id,title,company,workplace_type,active,published_at")
    .limit(3);

  if (error) {
    throw new Error(`Falha ao ler vagas: ${error.message}`);
  }

  console.log("\nAmostra:");

  console.table(
    data.map((job) => ({
      source: job.source,
      external_id: job.external_id,
      titulo: job.title,
      empresa: job.company,
      modalidade: job.workplace_type,
      ativa: job.active,
      publicada_em: job.published_at,
    })),
  );

  console.log("\n====================================");
  console.log("TESTE FINALIZADO COM SUCESSO");
  console.log("Nenhum registro foi alterado.");
  console.log("====================================");
}

main().catch((error) => {
  console.error("\n❌ ERRO:", error instanceof Error ? error.message : error);

  process.exitCode = 1;
});
