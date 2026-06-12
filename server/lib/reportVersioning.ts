export function nextMonthlyVersion(version: string) {
  const [yearValue, monthValue] = version.split("-").map(Number);
  const nextMonth = monthValue === 12 ? 1 : monthValue + 1;
  const nextYear = monthValue === 12 ? yearValue + 1 : yearValue;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

export function formatVersionMonth(version: string) {
  const [year, month] = version.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function versionToken(version: string, revision: number) {
  return `db-${version}.${revision}`;
}
