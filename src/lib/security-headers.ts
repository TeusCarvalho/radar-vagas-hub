/**
 * Cabeçalhos HTTP defensivos para páginas SSR do Worker.
 * Não inclui CSP bloqueante: TanStack Start injeta scripts de hidratação
 * e a política precisa ser testada especificamente antes de ser aplicada.
 *
 * Respeita status, body streaming e demais headers da resposta original.
 */
export function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);

  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set("Strict-Transport-Security", "max-age=31536000");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
