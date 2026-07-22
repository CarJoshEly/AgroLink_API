/**
 * Stub de `sanitize-html` para pruebas: la librería real depende de `htmlparser2`,
 * que es ESM-only y rompe la carga de módulos de Jest (CommonJS). El comportamiento
 * real de sanitización ya se verifica en vivo (ver Sprint 14); aquí solo se necesita
 * que el grafo de módulos cargue sin errores.
 */
export default function sanitizeHtml(value: string): string {
  return value;
}
