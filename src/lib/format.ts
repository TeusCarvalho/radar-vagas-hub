export function relativeDate(value: string) {
  const published = new Date(value);

  if (Number.isNaN(published.getTime())) {
    return "Data não informada";
  }

  const today = new Date();

  const publishedDay = new Date(published.getFullYear(), published.getMonth(), published.getDate());

  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const diffMs = todayDay.getTime() - publishedDay.getTime();

  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return "Publicada hoje";
  }

  if (diffDays === 1) {
    return "Publicada ontem";
  }

  if (diffDays > 1 && diffDays <= 7) {
    return `Publicada há ${diffDays} dias`;
  }

  return `Publicada em ${published.toLocaleDateString("pt-BR")}`;
}
