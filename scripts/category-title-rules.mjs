// Classificação por cargo explícito: descrição de empresa não deve transformar
// "Vendedor Interno – Friboi" em "Produto" só por citar produtos vendidos.
// Restringimos as correções a funções comerciais inequívocas.
const SALES_TITLES = [
  /\bvendedor(?:a|es|as)?\b/,
  /\bconsultor(?:a)? de vendas\b/,
  /\bconsultor(?:a)? comercial\b/,
  /\brepresentante comercial\b/,
  /\bexecutiv[oa] comercial\b/,
  /\bexecutiv[oa] de vendas\b/,
  /\bexecutiv[oa] de contas\b/,
  /\bgerente de vendas\b/,
  /\bsupervisor(?:a)? de vendas\b/,
  /\bassistente de vendas\b/,
  /\bpromotor(?:a)? de vendas\b/,
  /\binside sales\b/,
  /\bsales representative\b/,
  /\bsales executive\b/,
  /\baccount executive\b/,
  /\b(?:sdr|bdr)\b/,
];

function normalized(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Correções determinísticas e conservadoras para cargos explícitos.
 * Retorna null quando o título não oferece evidência suficiente, preservando
 * a categoria de origem em vez de adivinhar a partir da descrição.
 */
export function definitiveCategoryFromTitle(title) {
  const text = normalized(title);
  if (SALES_TITLES.some((pattern) => pattern.test(text))) {
    return "Comercial e Vendas";
  }
  return null;
}

export function refineCategory(title, category) {
  return definitiveCategoryFromTitle(title) ?? category ?? "Outros";
}
