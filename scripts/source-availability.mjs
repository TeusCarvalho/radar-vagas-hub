// Política única para preservar o catálogo quando uma fonte externa falha.
// Apenas InfoJobs pode ser omitido e SOMENTE numa carga não destrutiva.
export const EXPECTED_SOURCES = Object.freeze([
  "gupy", "inhire", "greenhouse", "lever", "ashby", "infojobs",
]);

export function validateSourceCoverage(sourceCounts, { allowMissingInfojobs = false } = {}) {
  const unexpected = Object.keys(sourceCounts).filter((source) => !EXPECTED_SOURCES.includes(source));
  if (unexpected.length > 0) {
    throw new Error(`Fontes desconhecidas no catálogo: ${unexpected.join(", ")}`);
  }

  const missing = EXPECTED_SOURCES.filter((source) => {
    const count = sourceCounts[source] ?? 0;
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new Error(`Contagem inválida para ${source}: ${count}`);
    }
    return count === 0;
  });

  if (missing.length === 0 && allowMissingInfojobs) {
    throw new Error("Flag de fallback InfoJobs ativa, mas InfoJobs está no catálogo. Abortando.");
  }

  if (missing.length > 0 &&
      !(allowMissingInfojobs && missing.length === 1 && missing[0] === "infojobs")) {
    throw new Error(`Fontes sem vagas elegíveis: ${missing.join(", ")}. Sincronização bloqueada.`);
  }

  return { partial: missing.length === 1, missing };
}
