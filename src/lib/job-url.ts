/**
 * Vagas são provenientes de fontes externas. Nunca aceitar protocolos
 * executáveis (javascript:, data:, file:) em links de candidatura.
 */
export function safeJobApplicationUrl(value: unknown): string | null {
  if (typeof value !== "string" || !/^https?:\/\//i.test(value.trim())) {
    return null;
  }

  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    if (!parsed.hostname) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}
