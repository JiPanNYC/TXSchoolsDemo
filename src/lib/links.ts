export function normalizeHref(href: string) {
  const trimmed = href.trim();

  if (
    /^(https?:|mailto:|tel:)/i.test(trimmed) ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("#")
  ) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

export function isHttpUrl(href: string) {
  return /^https?:\/\//i.test(href);
}
