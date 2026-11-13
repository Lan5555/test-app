export type ToastType = "success" | "error" | "info" | "warning";

export function toastMessage(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value))
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .join(" ");
  return "";
}

export function toastDuration(type: ToastType, value?: number): number {
  if (typeof value === "number" && Number.isFinite(value))
    return Math.max(0, value);
  return type === "error" ? 6500 : type === "warning" ? 5500 : 4000;
}

export function remainingToastTime(
  remaining: number,
  startedAt: number,
  now: number,
): number {
  return Math.max(0, remaining - Math.max(0, now - startedAt));
}
