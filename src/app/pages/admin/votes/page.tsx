"use client";

import { LogOut, Plus, Search, ShieldCheck, Users, Vote } from "lucide-react";
import Link from "next/link";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import VotingAdminSignIn from "@/app/components/admin/voting-sign-in";
import { AdminSectionHeading } from "@/app/components/admin/workspace";
import { CandidatePortrait, VotingImage } from "@/app/votes/image";
import VotingImageUpload, {
  type ImageUploadStatus,
} from "@/app/votes/image-upload";
import {
  clearVotingAdminSession,
  money,
  readVotingAdminSession,
  VotingApiError,
  votingService,
} from "@/app/votes/service";
import type {
  Poll,
  PollDetail,
  PollInput,
  UploadedVotingImage,
} from "@/app/votes/types";
import {
  input,
  Notice,
  panel,
  primary,
  ShareLink,
  secondary,
  VotingShell,
} from "@/app/votes/ui";

export default function AdminVotesPage() {
  const [cover, setCover] = useState<UploadedVotingImage | null>(null);
  const [portrait, setPortrait] = useState<UploadedVotingImage | null>(null);
  const [coverStatus, setCoverStatus] = useState<ImageUploadStatus>("idle");
  const [portraitVersion, setPortraitVersion] = useState(0);
  const [portraitStatus, setPortraitStatus] =
    useState<ImageUploadStatus>("idle");
  const imageBusy =
    coverStatus === "uploading" || portraitStatus === "uploading";
  const [authorized, setAuthorized] = useState(false);
  const [pollSearch, setPollSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [polls, setPolls] = useState<Poll[]>([]);
  const [detail, setDetail] = useState<PollDetail | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [sessionName, setSessionName] = useState("");
  const authEpoch = useRef(0);
  const handleFailure = useCallback((failure: unknown, fallback: string) => {
    if (
      failure instanceof VotingApiError &&
      [401, 403].includes(failure.status)
    ) {
      authEpoch.current++;
      clearVotingAdminSession();
      setAuthorized(false);
      setPolls([]);
      setDetail(null);
      setSelectedId("");
      setShowCreate(false);
    }
    setError(failure instanceof Error ? failure.message : fallback);
  }, []);

  const load = useCallback(async () => {
    const epoch = authEpoch.current;
    setLoading(true);
    setError("");
    try {
      const result = await votingService.adminPolls();
      if (epoch === authEpoch.current) setPolls(result);
    } catch (e) {
      if (epoch === authEpoch.current)
        handleFailure(e, "Unable to load polls.");
    } finally {
      setLoading(false);
    }
  }, [handleFailure]);

  useEffect(() => {
    try {
      const session = readVotingAdminSession();
      if (!session) {
        setLoading(false);
        return;
      }
      setAuthorized(true);
      setSessionName(session.name || session.email || "Voting administrator");
      void load();
    } catch {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    if (!selectedId || !authorized) return;
    let active = true;
    setDetail(null);
    setDetailLoading(true);
    votingService
      .adminPoll(selectedId)
      .then((data) => {
        if (active) setDetail(data);
      })
      .catch((e) => {
        if (active) handleFailure(e, "Unable to load poll.");
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedId, authorized, handleFailure]);

  async function createPoll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || imageBusy) return;
    if (coverStatus === "error") {
      setError(
        "Finish the cover upload, or remove it to continue without an image.",
      );
      return;
    }
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const priceText = String(data.get("price"));
      if (!/^\d+(\.\d{1,2})?$/.test(priceText))
        throw new Error("Enter a price with at most two decimal places.");
      const votePriceMinor = Math.round(Number(priceText) * 100);
      const opensAt = new Date(String(data.get("opensAt"))).toISOString();
      const closesAt = new Date(String(data.get("closesAt"))).toISOString();
      if (Date.parse(closesAt) <= Date.parse(opensAt))
        throw new Error("Closing time must be after opening time.");
      if (Date.parse(closesAt) <= Date.now())
        throw new Error("Closing time must be in the future.");
      if (!Number.isSafeInteger(votePriceMinor) || votePriceMinor < 1)
        throw new Error("Enter a valid positive vote price.");
      const payload: PollInput = {
        title: String(data.get("title")).trim(),
        description: String(data.get("description")).trim(),
        currency: "NGN",
        votePriceMinor,
        maxVotesPerPurchase: Number(data.get("maxVotes")),
        opensAt,
        closesAt,
        resultsVisible: data.get("resultsVisible") === "on",
        imageId: cover?.imageId || null,
      };
      const poll = await votingService.createPoll(payload);
      setPolls((previous) => [poll, ...previous]);
      setSelectedId(poll.id);
      setPortrait(null);
      setPortraitStatus("idle");
      setPortraitVersion((value) => value + 1);
      setShowCreate(false);
      setCover(null);
      setCoverStatus("idle");
      form.reset();
      setMessage("Draft poll created. Register candidates before publishing.");
    } catch (e) {
      handleFailure(e, "Unable to create poll.");
    } finally {
      setBusy(false);
    }
  }

  async function registerCandidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || imageBusy) return;
    if (portraitStatus === "error") {
      setError(
        "Finish the portrait upload, or remove it to continue without an image.",
      );
      return;
    }
    if (!detail) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const candidate = await votingService.addCandidate(detail.poll.id, {
        name: String(data.get("name")).trim(),
        bio: String(data.get("bio")).trim(),
        photoImageId: portrait?.imageId || null,
      });
      setDetail((previous) =>
        previous
          ? {
              ...previous,
              candidates: [...previous.candidates, candidate],
              poll: {
                ...previous.poll,
                candidateCount: previous.poll.candidateCount + 1,
              },
            }
          : null,
      );
      setPolls((previous) =>
        previous.map((p) =>
          p.id === detail.poll.id
            ? { ...p, candidateCount: p.candidateCount + 1 }
            : p,
        ),
      );
      form.reset();
      setPortrait(null);
      setPortraitStatus("idle");
      setPortraitVersion((value) => value + 1);
      setMessage("Candidate registered.");
    } catch (e) {
      handleFailure(e, "Unable to register candidate.");
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(status: "PUBLISHED" | "CLOSED") {
    if (busy || imageBusy) return;
    if (!detail) return;
    if (
      !window.confirm(
        status === "PUBLISHED"
          ? "Publish this poll? Its price, dates, and candidate list will be locked."
          : "Close this poll and stop new purchases? Existing payments will still be reconciled.",
      )
    )
      return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const poll = await votingService.setStatus(detail.poll.id, status);
      setDetail((previous) => (previous ? { ...previous, poll } : null));
      setPolls((previous) =>
        previous.map((p) => (p.id === poll.id ? poll : p)),
      );
      setMessage(
        status === "PUBLISHED"
          ? "Poll published. Share its link to invite voters."
          : "Poll closed.",
      );
    } catch (e) {
      handleFailure(e, "Unable to update poll.");
    } finally {
      setBusy(false);
    }
  }

  const filteredPolls = polls.filter(
    (poll) =>
      (statusFilter === "ALL" || poll.status === statusFilter) &&
      poll.title.toLowerCase().includes(pollSearch.trim().toLowerCase()),
  );

  if (!authorized)
    return (
      <VotingShell admin>
        {loading ? (
          <Notice>Checking voting admin session…</Notice>
        ) : (
          <VotingAdminSignIn
            initialMessage={error}
            onAuthenticated={(session) => {
              authEpoch.current++;
              setSessionName(
                session.name || session.email || "Voting administrator",
              );
              setAuthorized(true);
              setError("");
              setMessage("");
              void load();
            }}
          />
        )}
      </VotingShell>
    );
  return (
    <VotingShell admin>
      <div className="admin-voting-sessionbar">
        <div>
          <ShieldCheck size={16} />
          <span>Voting admin session</span>
          <strong>{sessionName}</strong>
        </div>
        <button
          type="button"
          disabled={busy || imageBusy}
          onClick={() => {
            authEpoch.current++;
            clearVotingAdminSession();
            setAuthorized(false);
            setPolls([]);
            setDetail(null);
            setSelectedId("");
            setMessage("");
            setError("");
            setShowCreate(false);
          }}
        >
          <LogOut size={14} />
          Sign out of voting
        </button>
      </div>
      <AdminSectionHeading
        eyebrow="Voting workspace"
        title="Polls & candidates"
        description="Bring candidates together, publish your polls, and follow verified voting activity."
      >
        <div className="flex gap-2">
          <Link href="/pages/votes" className={secondary}>
            Public voting
          </Link>
          <button
            type="button"
            className={primary}
            onClick={() => {
              setCover(null);
              setCoverStatus("idle");
              setShowCreate(!showCreate);
            }}
            disabled={busy || imageBusy}
          >
            <Plus size={18} />
            {showCreate ? "Hide form" : "Create poll"}
          </button>
        </div>
      </AdminSectionHeading>
      <div className="admin-voting-overview">
        <div>
          <span>Loaded polls</span>
          <strong>{loading ? "—" : polls.length}</strong>
        </div>
        <div>
          <span>Draft polls</span>
          <strong>
            {loading
              ? "—"
              : polls.filter((poll) => poll.status === "DRAFT").length}
          </strong>
        </div>
        <div>
          <span>Open polls</span>
          <strong>
            {loading
              ? "—"
              : polls.filter((poll) => poll.status === "OPEN").length}
          </strong>
        </div>
      </div>
      {error && <Notice error>{error}</Notice>}
      {message && <Notice>{message}</Notice>}
      {showCreate && (
        <section className={panel}>
          <h2 className="mb-5 text-xl font-bold">Create a new poll</h2>
          <form onSubmit={createPoll} className="grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-semibold sm:col-span-2">
              Poll title
              <input
                name="title"
                required
                maxLength={150}
                pattern=".*\S.*"
                className={`${input} mt-2`}
                placeholder="e.g. Student awards 2026"
              />
            </label>
            <label className="text-sm font-semibold sm:col-span-2">
              Description
              <textarea
                name="description"
                required
                maxLength={3000}
                rows={3}
                className={`${input} mt-2`}
                placeholder="Tell voters what this poll is about"
              />
            </label>
            <label className="text-sm font-semibold">
              Price per vote (NGN)
              <input
                name="price"
                type="number"
                min="0.01"
                step="0.01"
                required
                className={`${input} mt-2`}
                placeholder="100.00"
              />
            </label>
            <label className="text-sm font-semibold">
              Maximum votes per purchase
              <input
                name="maxVotes"
                type="number"
                min="1"
                max="100000"
                step="1"
                required
                defaultValue="1000"
                className={`${input} mt-2`}
              />
            </label>
            <label className="text-sm font-semibold">
              Opens at
              <input
                name="opensAt"
                type="datetime-local"
                required
                className={`${input} mt-2`}
              />
            </label>
            <label className="text-sm font-semibold">
              Closes at
              <input
                name="closesAt"
                type="datetime-local"
                required
                className={`${input} mt-2`}
              />
            </label>
            <p className="text-xs text-slate-500 sm:col-span-2">
              Times use your browser’s local timezone and are submitted as UTC.
              Currency: Nigerian naira (NGN).
            </p>
            <label className="flex items-center gap-3 text-sm sm:col-span-2">
              <input
                name="resultsVisible"
                type="checkbox"
                className="h-4 w-4 accent-indigo-600"
              />
              Show verified vote totals publicly
            </label>
            <div className="sm:col-span-2">
              <VotingImageUpload
                purpose="POLL"
                value={cover}
                onChange={setCover}
                onStatus={setCoverStatus}
                onAuthError={(failure) =>
                  handleFailure(failure, "Unable to upload cover.")
                }
                disabled={busy}
              />
            </div>
            <button
              type="submit"
              className={`${primary} sm:col-span-2`}
              disabled={busy || imageBusy || coverStatus === "error"}
            >
              {busy ? "Saving…" : "Save draft poll"}
            </button>
          </form>
        </section>
      )}
      <div className="admin-poll-layout grid items-start gap-6 lg:grid-cols-[300px_1fr]">
        <section className={`admin-poll-library ${panel}`}>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-bold">Your polls</h2>
            <button
              type="button"
              disabled={loading || busy || imageBusy}
              onClick={load}
              className="text-sm font-semibold text-indigo-600"
            >
              Refresh
            </button>
          </div>
          <div className="admin-poll-filters">
            <label className="admin-search">
              <Search size={15} />
              <span className="sr-only">Search polls</span>
              <input
                type="search"
                value={pollSearch}
                onChange={(event) => setPollSearch(event.target.value)}
                placeholder="Search your polls…"
              />
            </label>
            <label>
              <span className="sr-only">Filter polls by status</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="ALL">All statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="OPEN">Open</option>
                <option value="CLOSED">Closed</option>
              </select>
            </label>
          </div>
          {loading ? (
            <p aria-live="polite" className="text-sm text-slate-500">
              Loading polls…
            </p>
          ) : filteredPolls.length === 0 ? (
            <p className="text-sm text-slate-500">
              {polls.length
                ? "No polls match your search or status filter."
                : "Create your first poll to start registering candidates. If loading failed, use Refresh to try again."}
            </p>
          ) : (
            <div className="space-y-3">
              {filteredPolls.map((poll) => (
                <button
                  type="button"
                  key={poll.id}
                  disabled={busy || imageBusy}
                  onClick={() => {
                    setPortrait(null);
                    setPortraitStatus("idle");
                    setSelectedId(poll.id);
                    setError("");
                  }}
                  aria-pressed={selectedId === poll.id}
                  className={`admin-poll-item w-full rounded-2xl border p-4 text-left ${selectedId === poll.id ? "border-indigo-400 bg-indigo-50" : "border-slate-200 hover:bg-slate-50"}`}
                >
                  <VotingImage
                    src={poll.imageUrl}
                    alt=""
                    className="admin-poll-thumb"
                  />
                  <span className="text-xs font-bold text-indigo-600">
                    {poll.status}
                  </span>
                  <strong className="mt-1 block">{poll.title}</strong>
                  <span className="mt-2 block text-xs text-slate-500">
                    {poll.candidateCount} candidates ·{" "}
                    {money(poll.votePriceMinor)} / vote
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
        {detailLoading ? (
          <Notice>Loading poll details…</Notice>
        ) : !detail ? (
          <div className={`${panel} py-16 text-center`}>
            <Vote className="mx-auto mb-4 text-indigo-400" size={40} />
            <h2 className="font-bold">Choose a poll to manage</h2>
            <p className="mt-2 text-sm text-slate-500">
              Candidates and sharing options appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <section className={panel}>
              <VotingImage
                src={detail.poll.imageUrl}
                alt={`Cover for ${detail.poll.title}`}
                className="admin-poll-cover"
                priority
              />
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <span className="text-xs font-bold text-indigo-600">
                    {detail.poll.status}
                  </span>
                  <h2 className="mt-2 text-2xl font-bold">
                    {detail.poll.title}
                  </h2>
                </div>
                {detail.poll.status !== "DRAFT" && (
                  <ShareLink slug={detail.poll.slug} />
                )}
              </div>
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-500">
                {detail.poll.description}
              </p>
              <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                <p>Opens: {new Date(detail.poll.opensAt).toLocaleString()}</p>
                <p>Closes: {new Date(detail.poll.closesAt).toLocaleString()}</p>
                <p>Vote price: {money(detail.poll.votePriceMinor)}</p>
                <p>
                  Verified votes:{" "}
                  {detail.poll.totalVotes === null
                    ? "Unavailable"
                    : detail.poll.totalVotes.toLocaleString()}
                </p>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                {detail.poll.status === "DRAFT" ? (
                  <button
                    type="button"
                    className={primary}
                    disabled={
                      busy || imageBusy || detail.candidates.length === 0
                    }
                    onClick={() => changeStatus("PUBLISHED")}
                  >
                    Publish poll
                  </button>
                ) : (
                  <>
                    <Link
                      className={secondary}
                      href={`/pages/votes/${encodeURIComponent(detail.poll.slug)}`}
                    >
                      View public poll
                    </Link>
                    {detail.poll.status !== "CLOSED" && (
                      <button
                        type="button"
                        className={secondary}
                        disabled={busy || imageBusy}
                        onClick={() => changeStatus("CLOSED")}
                      >
                        Close poll
                      </button>
                    )}
                  </>
                )}
              </div>
            </section>
            {detail.poll.status === "DRAFT" && (
              <section className={panel}>
                <h2 className="mb-5 text-xl font-bold">Register candidate</h2>
                <form onSubmit={registerCandidate} className="space-y-4">
                  <label className="block text-sm font-semibold">
                    Full name
                    <input
                      name="name"
                      required
                      maxLength={150}
                      pattern=".*\S.*"
                      className={`${input} mt-2`}
                    />
                  </label>
                  <label className="block text-sm font-semibold">
                    Bio / introduction
                    <textarea
                      name="bio"
                      required
                      maxLength={2000}
                      rows={3}
                      className={`${input} mt-2`}
                    />
                  </label>
                  <VotingImageUpload
                    key={selectedId + "-" + portraitVersion}
                    purpose="CANDIDATE"
                    value={portrait}
                    onChange={setPortrait}
                    onStatus={setPortraitStatus}
                    onAuthError={(failure) =>
                      handleFailure(failure, "Unable to upload portrait.")
                    }
                    disabled={busy}
                  />
                  <button
                    type="submit"
                    className={primary}
                    disabled={busy || imageBusy || portraitStatus === "error"}
                  >
                    <Plus size={16} />
                    {busy ? "Saving…" : "Register candidate"}
                  </button>
                </form>
              </section>
            )}
            <section className={panel}>
              <h2 className="mb-5 flex items-center gap-2 text-xl font-bold">
                <Users size={20} />
                Candidates ({detail.candidates.length})
              </h2>
              {detail.candidates.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Register at least one candidate before publishing.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {detail.candidates.map((candidate) => (
                    <div
                      key={candidate.id}
                      className="flex flex-wrap items-center justify-between gap-4 py-4"
                    >
                      <div className="admin-candidate-identity">
                        <CandidatePortrait
                          src={candidate.photoUrl}
                          name={candidate.name}
                          className="admin-candidate-portrait"
                        />
                        <div className="min-w-0">
                          <p className="font-bold">{candidate.name}</p>
                          <p className="mt-1 text-sm text-slate-500">
                            {candidate.voteCount === null
                              ? "Votes unavailable"
                              : `${candidate.voteCount.toLocaleString()} verified votes`}
                          </p>
                        </div>
                      </div>
                      {detail.poll.status !== "DRAFT" && (
                        <ShareLink
                          slug={detail.poll.slug}
                          candidateId={candidate.id}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </VotingShell>
  );
}
