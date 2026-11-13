import type {
  Candidate,
  CandidateInput,
  Checkout,
  Poll,
  PollDetail,
  PollInput,
  UploadedVotingImage,
  VoteAttempt,
  VoteReceipt,
  VotingAdminLogin,
  VotingAdminSession,
  VotingEnvelope,
  VotingImagePurpose,
} from "./types";

export class VotingApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "VotingApiError";
  }
}

export const VOTING_ADMIN_SESSION_KEY = "votingAdminSession";
export function readVotingAdminSession(): VotingAdminSession | null {
  try {
    const session = JSON.parse(
      sessionStorage.getItem(VOTING_ADMIN_SESSION_KEY) || "null",
    );
    return session?.type === "voting-admin" &&
      typeof session.token === "string" &&
      session.token.trim()
      ? session
      : null;
  } catch {
    return null;
  }
}
export function saveVotingAdminSession(
  login: VotingAdminLogin,
): VotingAdminSession {
  if (typeof login?.token !== "string" || !login.token.trim())
    throw new Error("Voting sign-in could not be completed. Please try again.");
  const session: VotingAdminSession = {
    type: "voting-admin",
    token: login.token,
    name: typeof login.name === "string" ? login.name : "",
    email: typeof login.email === "string" ? login.email : "",
  };
  sessionStorage.setItem(VOTING_ADMIN_SESSION_KEY, JSON.stringify(session));
  return session;
}
export function clearVotingAdminSession() {
  sessionStorage.removeItem(VOTING_ADMIN_SESSION_KEY);
}

// Voting admin tokens never fall back to portal-admin or student sessions.
async function request<T>(
  path: string,
  options: RequestInit = {},
  admin = false,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (typeof FormData !== "undefined" && options.body instanceof FormData) {
    headers.delete("Content-Type");
  } else {
    headers.set("Content-Type", "application/json");
  }
  if (admin) {
    const session = readVotingAdminSession();
    if (!session)
      throw new VotingApiError(
        "Please sign in to voting administration.",
        401,
        "VOTING_ADMIN_AUTH_REQUIRED",
      );
    headers.set("Authorization", `Bearer ${session.token}`);
  }
  const response = await fetch(
    `${(process.env.NEXT_PUBLIC_DATABASE_LINK || "").replace(/\/+$/, "")}/votes/api${path}`,
    { ...options, headers, cache: "no-store" },
  );
  const body = (await response
    .json()
    .catch(() => null)) as VotingEnvelope<T> | null;
  if (!response.ok || body?.success !== true) {
    throw new VotingApiError(
      votingMessage(body?.message) ||
        (response.status === 404
          ? "Voting is not available yet. Please try again later."
          : "Unable to complete this request. Please try again."),
      response.status,
      body?.code,
    );
  }
  return body.data as T;
}

function votingMessage(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value))
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .join(" ");
  return "";
}

export const votingService = {
  uploadImage: async (
    file: File,
    purpose: VotingImagePurpose,
    signal?: AbortSignal,
  ) => {
    validateVotingImage(file);
    const form = new FormData();
    form.append("purpose", purpose);
    form.append("file", file);
    const uploaded = await request<UploadedVotingImage>(
      "/admin/images",
      {
        method: "POST",
        body: form,
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(60_000)])
          : AbortSignal.timeout(60_000),
      },
      true,
    );
    if (
      !uploaded ||
      typeof uploaded.imageId !== "string" ||
      !uploaded.imageId.trim() ||
      uploaded.purpose !== purpose ||
      !votingImageUrl(uploaded.url)
    ) {
      throw new Error(
        "The image upload could not be confirmed. Please try again or continue without an image.",
      );
    }
    return uploaded;
  },
  adminLogin: (password: string) =>
    request<VotingAdminLogin>("/admin/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
  polls: () => request<Poll[]>("/polls"),
  poll: (slug: string) =>
    request<PollDetail>(`/polls/${encodeURIComponent(slug)}`),
  adminPolls: () => request<Poll[]>("/admin/polls", {}, true),
  adminPoll: (id: string) =>
    request<PollDetail>(`/admin/polls/${encodeURIComponent(id)}`, {}, true),
  createPoll: (input: PollInput) =>
    request<Poll>(
      "/admin/polls",
      { method: "POST", body: JSON.stringify(input) },
      true,
    ),
  setStatus: (id: string, status: "PUBLISHED" | "CLOSED") =>
    request<Poll>(
      `/admin/polls/${encodeURIComponent(id)}/status`,
      { method: "POST", body: JSON.stringify({ status }) },
      true,
    ),
  addCandidate: (id: string, input: CandidateInput) =>
    request<Candidate>(
      `/admin/polls/${encodeURIComponent(id)}/candidates`,
      { method: "POST", body: JSON.stringify(input) },
      true,
    ),
  checkout: ({ key, ...body }: VoteAttempt) =>
    request<Checkout>("/purchases", {
      method: "POST",
      headers: { "Idempotency-Key": key },
      body: JSON.stringify(body),
    }),
  receipt: (purchaseId: string, token: string) =>
    request<VoteReceipt>(`/purchases/${encodeURIComponent(purchaseId)}`, {
      headers: { "X-Vote-Receipt-Token": token },
    }),
};

export const VOTING_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const VOTING_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";
export function validateVotingImage(file: Pick<File, "type" | "size">) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Choose a JPEG, PNG, or WebP image.");
  if (!Number.isFinite(file.size) || file.size <= 0)
    throw new Error("This image is empty. Please choose another file.");
  if (file.size > VOTING_IMAGE_MAX_BYTES)
    throw new Error("Choose an image no larger than 5 MiB.");
}
export function votingImageUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function money(amountMinor: number, currency = "NGN") {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency }).format(
    amountMinor / 100,
  );
}

export function isPollOpen(poll: Poll) {
  const now = Date.now();
  return (
    poll.status === "OPEN" &&
    now >= Date.parse(poll.opensAt) &&
    now < Date.parse(poll.closesAt)
  );
}

export function checkoutAddress(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error("The payment link is invalid. Please contact support.");
  return url.href;
}
