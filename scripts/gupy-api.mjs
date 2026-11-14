// API de busca pública utilizada pelo portal de vagas da Gupy (não é a API
// autenticada de clientes em api.gupy.io). Mudanças no contrato devem falhar
// explicitamente para impedir sincronizações com dados vazios/incompletos.
export const GUPY_SEARCH_URL = "https://portal.gupy.io/api/job-search/jobs";

export function buildGupySearchUrl(offset = 0, limit = 100, filters = {}) {
  if (!Number.isInteger(offset) || offset < 0 || offset > 9_900) {
    throw new RangeError("Gupy: offset fora da faixa permitida (0–9900).");
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new RangeError("Gupy: limit deve estar entre 1 e 100.");
  }
  const url = new URL(GUPY_SEARCH_URL);
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("limit", String(limit));

  for (const [key, value] of Object.entries(filters)) {
    if (!["type", "workplaceType", "state", "jobName"].includes(key)) {
      throw new Error(`Gupy: filtro não suportado: ${key}`);
    }
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export function extractGupyRows(json) {
  if (!json || typeof json !== "object" || !Array.isArray(json.data)) {
    const shape = json && typeof json === "object"
      ? Object.keys(json).join(", ")
      : typeof json;
    throw new Error(
      `Gupy: formato inesperado da resposta (esperado data: array; recebido: ${shape}).`,
    );
  }
  return json.data;
}
