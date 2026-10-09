export function dateLabel(value: string | null, long = false): string {
  if (!value) return "Date to confirm";
  return new Intl.DateTimeFormat("en-IE", {
    day: "numeric",
    month: long ? "long" : "short",
    timeZone: "UTC",
  }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
}
export function addDays(value: string, count: number): string {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}
export function moduleColor(module: string): string {
  let hash = 0;
  for (const char of module) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return ["#658168", "#b67453", "#8581aa", "#53879a", "#a58332"][
    Math.abs(hash) % 5
  ];
}
export function monthCells(month: string): (string | null)[] {
  const first = new Date(`${month}-01T12:00:00Z`);
  const offset = (first.getUTCDay() + 6) % 7;
  const count = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return [
    ...Array<null>(offset).fill(null),
    ...Array.from(
      { length: count },
      (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`,
    ),
  ];
}
export function shiftMonth(month: string, offset: number): string {
  const date = new Date(`${month}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}
