"use client";

import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  Check,
  Heart,
  Minus,
  Plus,
  ShieldCheck,
  Sparkles,
  UserRound,
  Vote,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CandidatePortrait, VotingImage } from "@/app/votes/image";
import { VotingSkeleton } from "@/app/votes/presentation";
import {
  checkoutAddress,
  isPollOpen,
  money,
  VotingApiError,
  votingService,
} from "@/app/votes/service";
import type { Candidate, PollDetail, VoteAttempt } from "@/app/votes/types";
import {
  input,
  Notice,
  panel,
  primary,
  ShareLink,
  secondary,
  VotingShell,
} from "@/app/votes/ui";

export default function PollPage() {
  const { slug } = useParams<{ slug: string }>();
  const [detail, setDetail] = useState<PollDetail | null>(null);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [payError, setPayError] = useState("");
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [attempt, setAttempt] = useState<VoteAttempt | null>(null);
  const [now, setNow] = useState(Date.now());
  const paymentLock = useRef(false);
  const formRef = useRef<HTMLElement>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setAttempt(null);
    setSelected(null);
    setQuantity("1");
    setEmail("");
    try {
      const data = await votingService.poll(slug);
      setDetail(data);
      const sharedId = new URLSearchParams(window.location.search).get(
        "candidate",
      );
      setSelected(data.candidates.find((c) => c.id === sharedId) || null);
      const pending = sessionStorage.getItem(`vote-attempt:${data.poll.id}`);
      if (pending) {
        const saved: VoteAttempt = JSON.parse(pending);
        if (saved.pollId === data.poll.id) {
          setAttempt(saved);
          setEmail(saved.email);
          setQuantity(String(saved.quantity));
          setSelected(
            data.candidates.find((c) => c.id === saved.candidateId) || null,
          );
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load this poll.");
    } finally {
      setLoading(false);
    }
  }, [slug]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
  const poll = detail?.poll;
  // Re-evaluate the schedule while the page remains open; server still enforces it.
  const open = poll
    ? isPollOpen(poll) && now < Date.parse(poll.closesAt)
    : false;
  const count = Number(quantity);
  const validQuantity =
    Number.isSafeInteger(count) &&
    count >= 1 &&
    count <= (poll?.maxVotesPerPurchase || 0);

  async function pay() {
    if (!poll || !selected || !validQuantity || paymentLock.current) return;
    paymentLock.current = true;
    setPaying(true);
    setPayError("");
    try {
      const purchase: VoteAttempt = attempt || {
        key: crypto.randomUUID(),
        pollId: poll.id,
        candidateId: selected.id,
        quantity: count,
        email: email.trim(),
      };
      // Persist before making a request. An uncertain retry always uses the same body/key.
      sessionStorage.setItem(
        `vote-attempt:${poll.id}`,
        JSON.stringify(purchase),
      );
      setAttempt(purchase);
      const checkout = await votingService.checkout(purchase);
      const address = checkoutAddress(checkout.checkoutUrl);
      sessionStorage.setItem(
        `vote-receipt:${checkout.purchaseId}`,
        checkout.receiptToken,
      );
      sessionStorage.setItem(`vote-checkout:${poll.id}`, checkout.purchaseId);
      window.location.assign(address);
    } catch (e) {
      if (e instanceof VotingApiError && e.code === "PURCHASE_NOT_CREATED") {
        // Only this explicit server guarantee permits changing an uncertain attempt.
        sessionStorage.removeItem(`vote-attempt:${poll.id}`);
        setAttempt(null);
      }
      setPayError(
        e instanceof Error
          ? e.message
          : "Unable to start payment. Retry to resume the same purchase.",
      );
    } finally {
      paymentLock.current = false;
      setPaying(false);
    }
  }

  function select(candidate: Candidate) {
    if (attempt) return;
    setSelected(candidate);
    setPayError("");
    requestAnimationFrame(() =>
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );
  }

  function checkPayment() {
    if (!poll) return;
    const purchaseId = sessionStorage.getItem(`vote-checkout:${poll.id}`);
    if (purchaseId)
      window.location.assign(
        `/pages/votes/payment?purchaseId=${encodeURIComponent(purchaseId)}`,
      );
    else
      setPayError(
        "Retry payment to recover the existing purchase, then check its status.",
      );
  }

  return (
    <VotingShell>
      <Link
        href="/pages/votes"
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500"
      >
        <ArrowLeft size={16} />
        All polls
      </Link>
      {loading ? (
        <VotingSkeleton />
      ) : error ? (
        <>
          <Notice error>{error}</Notice>
          <button type="button" className={secondary} onClick={load}>
            Try again
          </button>
        </>
      ) : (
        poll &&
        detail && (
          <>
            <section className="vote-detail-hero">
              <VotingImage
                src={poll.imageUrl}
                alt={`Cover for ${poll.title}`}
                className="vote-detail-cover"
                priority
              />
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div>
                  <span className="vote-detail-eyebrow">
                    <span className={open ? "is-live" : ""} />
                    {open
                      ? "Voting is open"
                      : poll.status === "OPEN"
                        ? "Voting is unavailable"
                        : poll.status}
                  </span>
                  <h1>{poll.title}</h1>
                </div>
                <ShareLink slug={poll.slug} />
              </div>
              <p className="vote-detail-description">{poll.description}</p>
              <div className="vote-detail-stats">
                <span>
                  <small>Make it count</small>
                  <strong>{money(poll.votePriceMinor, poll.currency)}</strong>{" "}
                  <small>per vote</small>
                </span>
                <span>
                  <small>
                    <CalendarDays size={12} />
                    Opens
                  </small>
                  <strong>{new Date(poll.opensAt).toLocaleString()}</strong>
                </span>
                <span>
                  <small>
                    <CalendarDays size={12} />
                    Closes
                  </small>
                  <strong>{new Date(poll.closesAt).toLocaleString()}</strong>
                </span>
                <span>
                  <small>
                    <Heart size={12} />
                    Community support
                  </small>
                  <strong>
                    {poll.totalVotes === null
                      ? "Results are hidden"
                      : `${poll.totalVotes.toLocaleString()} verified votes`}
                  </strong>
                </span>
              </div>
            </section>
            {!open && (
              <Notice>
                This poll is not currently accepting new payments. You can still
                share candidate links or check an existing payment.
              </Notice>
            )}
            <div className="vote-detail-layout">
              <section>
                <div className="vote-section-heading">
                  <div>
                    <span className="vote-section-kicker">
                      Who gets your support?
                    </span>
                    <h2>
                      Meet the candidates
                      <span className="vote-heading-dot">.</span>
                    </h2>
                  </div>
                  <span className="vote-candidate-count">
                    {detail.candidates.length}
                  </span>
                </div>
                {detail.candidates.length === 0 ? (
                  <div className={panel}>
                    No candidates have been registered yet.
                  </div>
                ) : (
                  <div className="vote-candidate-grid">
                    {detail.candidates.map((candidate) => (
                      <article
                        key={candidate.id}
                        className={`vote-candidate-card ${selected?.id === candidate.id ? "is-selected" : ""}`}
                      >
                        <div className="vote-candidate-portrait">
                          <CandidatePortrait
                            src={candidate.photoUrl}
                            name={candidate.name}
                          />
                          <span
                            className={`vote-portrait-badge ${selected?.id === candidate.id ? "is-selected" : ""}`}
                          >
                            {selected?.id === candidate.id ? (
                              <>
                                <Check size={13} />
                                Your choice
                              </>
                            ) : candidate.active ? (
                              <>
                                <Sparkles size={12} />
                                In the spotlight
                              </>
                            ) : (
                              "Unavailable"
                            )}
                          </span>
                        </div>
                        <div className="vote-candidate-body">
                          <h3>{candidate.name}</h3>
                          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-500">
                            {candidate.bio}
                          </p>
                          <p className="vote-candidate-votes">
                            <Heart size={14} />
                            {candidate.voteCount === null
                              ? "Results hidden"
                              : `${candidate.voteCount.toLocaleString()} votes`}
                          </p>
                          <div className="vote-candidate-actions">
                            <button
                              type="button"
                              className={`${primary} vote-candidate-choose`}
                              aria-pressed={selected?.id === candidate.id}
                              disabled={!open || !candidate.active || !!attempt}
                              onClick={() => select(candidate)}
                            >
                              {!candidate.active
                                ? "Unavailable"
                                : selected?.id === candidate.id
                                  ? "Your choice"
                                  : "Show your support"}
                              <ArrowUpRight size={16} />
                            </button>
                            <ShareLink
                              slug={poll.slug}
                              candidateId={candidate.id}
                              compact
                            />
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
              <section ref={formRef} className="vote-checkout">
                <div className="vote-checkout-head">
                  <span>
                    <Vote size={18} />
                  </span>
                  <p>Turn support into possibility</p>
                </div>
                <h2>Make their day.</h2>
                <p className="vote-checkout-intro">
                  Every vote is a little more belief in what comes next.
                </p>
                <div
                  className={`vote-selection ${selected ? "has-selection" : ""}`}
                >
                  <span className="vote-selection-avatar">
                    {selected ? (
                      selected.name
                        .split(/\s+/)
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((part) => part[0])
                        .join("")
                        .toUpperCase()
                    ) : (
                      <UserRound size={20} />
                    )}
                  </span>
                  <div>
                    <small>Your support goes to</small>
                    <strong>
                      {selected ? selected.name : "Choose your candidate"}
                    </strong>
                  </div>
                  {selected && (
                    <Check size={17} className="vote-selection-check" />
                  )}
                </div>
                {attempt && (
                  <div className="mt-4">
                    <Notice>
                      A purchase has been started. Retry to resume it, or check
                      its payment status before starting another.
                    </Notice>
                  </div>
                )}
                <form
                  className="vote-checkout-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void pay();
                  }}
                >
                  <div className="vote-quantity-field">
                    <label htmlFor="vote-quantity">Number of votes</label>
                    <div className="vote-quantity-stepper">
                      <button
                        type="button"
                        aria-label="Remove one vote"
                        disabled={
                          !!attempt || paying || !validQuantity || count <= 1
                        }
                        onClick={() => setQuantity(String(count - 1))}
                      >
                        <Minus size={16} />
                      </button>
                      <input
                        id="vote-quantity"
                        aria-describedby="vote-quantity-help"
                        className={input}
                        type="number"
                        min="1"
                        max={poll.maxVotesPerPurchase}
                        step="1"
                        required
                        value={quantity}
                        disabled={!!attempt || paying}
                        onChange={(e) => setQuantity(e.target.value)}
                      />
                      <button
                        type="button"
                        aria-label="Add one vote"
                        disabled={
                          !!attempt ||
                          paying ||
                          !validQuantity ||
                          count >= poll.maxVotesPerPurchase
                        }
                        onClick={() => setQuantity(String(count + 1))}
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    <p
                      id="vote-quantity-help"
                      className="mt-2 block text-xs font-normal text-slate-500"
                    >
                      Up to {poll.maxVotesPerPurchase} votes per purchase.
                    </p>
                  </div>
                  <fieldset
                    className="vote-quantity-picks"
                    aria-label="Quick vote quantities"
                  >
                    {[1, 5, 10, 25]
                      .filter((value) => value <= poll.maxVotesPerPurchase)
                      .map((value) => (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={count === value}
                          disabled={!!attempt || paying}
                          onClick={() => setQuantity(String(value))}
                        >
                          {value} {value === 1 ? "vote" : "votes"}
                        </button>
                      ))}
                  </fieldset>
                  <label className="block text-sm font-semibold">
                    Receipt email
                    <input
                      className={`${input} mt-2`}
                      type="email"
                      maxLength={254}
                      required
                      autoComplete="email"
                      value={email}
                      disabled={!!attempt || paying}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </label>
                  <div className="vote-total">
                    <span className="text-slate-500">Estimated total</span>
                    <strong>
                      {validQuantity
                        ? money(count * poll.votePriceMinor, poll.currency)
                        : "—"}
                    </strong>
                  </div>
                  <p className="text-xs leading-5 text-slate-500">
                    The payment provider shows the final charge. Votes are added
                    only after server verification.
                  </p>
                  {payError && <Notice error>{payError}</Notice>}
                  <button
                    className={`${primary} vote-pay-button w-full`}
                    type="submit"
                    disabled={
                      paying ||
                      (!attempt && (!open || !selected?.active)) ||
                      !selected ||
                      !validQuantity
                    }
                  >
                    {paying
                      ? "Opening payment…"
                      : attempt
                        ? "Resume payment"
                        : "Continue to payment"}
                    <ArrowUpRight size={17} />
                  </button>
                  {attempt && (
                    <button
                      type="button"
                      className={`${secondary} w-full`}
                      onClick={checkPayment}
                    >
                      Check payment status
                    </button>
                  )}
                  <p className="flex items-center justify-center gap-2 text-xs text-slate-500">
                    <ShieldCheck size={15} />
                    Pay through secure hosted checkout
                  </p>
                </form>
              </section>
            </div>
          </>
        )
      )}
    </VotingShell>
  );
}
