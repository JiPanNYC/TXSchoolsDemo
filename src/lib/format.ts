export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

export function formatDate(value: string | null) {
  if (!value) {
    return "Not published";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

export function freshnessLabel(lastUpdated: string) {
  const days = Math.max(
    0,
    Math.round((Date.now() - new Date(lastUpdated).getTime()) / 86_400_000)
  );

  if (days <= 14) {
    return { label: `${days} days old`, tone: "fresh" as const };
  }

  if (days <= 45) {
    return { label: `${days} days old`, tone: "watch" as const };
  }

  return { label: `${days} days old`, tone: "stale" as const };
}

export function numberFormatter(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export function currencyFormatter(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

export function percentFormatter(value: number) {
  return `${value.toFixed(1).replace(/\\.0$/, "")}%`;
}
