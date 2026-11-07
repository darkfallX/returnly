/** Keep dependency-supplied translations consistent with Returnly copy. */
export function normalizeCopy<T>(value: T): T {
  if (typeof value === "string") return value.replace(/\s*\u2014\s*/g, " - ") as T;
  if (Array.isArray(value)) return value.map(normalizeCopy) as T;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, text]) => [key, normalizeCopy(text)])) as T;
  return value;
}
