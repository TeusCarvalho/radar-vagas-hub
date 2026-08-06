export function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days <= 0) return "Publicada hoje";
  if (days === 1) return "Há 1 dia";
  if (days < 7) return `Há ${days} dias`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "Há 1 semana";
  if (days < 30) return `Há ${weeks} semanas`;
  const months = Math.floor(days / 30);
  return months === 1 ? "Há 1 mês" : `Há ${months} meses`;
}
