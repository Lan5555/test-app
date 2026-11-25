export const htmlEntities = [
  ["&", "&amp;"],
  ["<", "&lt;"],
  [">", "&gt;"],
  ['"', "&quot;"],
  ["'", "&#39;"],
] as const;

export const escapeHtml = (text: string) =>
  htmlEntities.reduce(
    (escaped, [character, entity]) => escaped.replaceAll(character, entity),
    text,
  );

export function isHttpsUrl(text: string) {
  try {
    const url = new URL(text);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function urlOrigin(text: string) {
  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.origin
      : "";
  } catch {
    return "";
  }
}

export const emailPattern =
  /(^|[^a-z0-9._%+-])[a-z0-9._%+-]{1,64}@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.){1,20}[a-z]{2,63}\b/gi;
export const emailReplacement = "$1[redacted]";
export const redactEmails = (text: string) =>
  text.replace(emailPattern, emailReplacement);
export const sha256Pattern = /^[a-f0-9]{64}$/i;
export const isSha256Digest = (text: string) => sha256Pattern.test(text);

export const securityHeaders = [
  "content-security-policy",
  "strict-transport-security",
  "x-content-type-options",
  "referrer-policy",
];

export function missingSecurityHeaders(headers: Record<string, unknown>) {
  const present = new Set(
    Object.entries(headers)
      .filter(([, value]) => typeof value === "string" && value.trim() !== "")
      .map(([name]) => name.toLowerCase()),
  );
  return securityHeaders.filter((name) => !present.has(name));
}
