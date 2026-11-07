/** All current Returnly branches use the Lagos store time zone. */
export function formatAppointmentWindow(slot?: { startAt: string; endAt: string } | null): string {
  if (!slot || !Number.isFinite(Date.parse(slot.startAt)) || !Number.isFinite(Date.parse(slot.endAt))) return "Time needs review";
  const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });
  return `${date.format(new Date(slot.startAt))} · ${time.format(new Date(slot.startAt))}–${time.format(new Date(slot.endAt))} WAT`;
}
