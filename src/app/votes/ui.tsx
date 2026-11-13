"use client";

import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Copy,
  Sparkles,
  Vote,
} from "lucide-react";
import Link from "next/link";
import { type ReactNode, useState } from "react";
import "./voting.css";

export const panel =
  "rounded-3xl border border-slate-200 bg-white p-6 shadow-sm";
export const input =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";
export const primary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50";
export const secondary =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50";

export function VotingShell({
  children,
  admin = false,
}: {
  children: ReactNode;
  admin?: boolean;
}) {
  return (
    <main
      className={`hub-voting min-h-screen bg-slate-50 text-slate-900 ${admin ? "admin-voting" : "vote-experience"}`}
    >
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-5">
          <Link
            href="/pages/votes"
            className="vote-brand flex items-center gap-3 font-bold"
          >
            <span className="rounded-xl bg-indigo-600 p-2.5 text-white">
              <Vote size={22} />
            </span>
            <span>
              Lan&apos;s Hub <span className="vote-brand-divider">/</span>{" "}
              <span className="vote-brand-section">Votes</span>
            </span>
          </Link>
          {!admin && (
            <nav className="vote-toplinks" aria-label="Voting navigation">
              <Link href="/pages/votes">Explore polls</Link>
              <Link href="/pages/votes#how-it-works">
                How it works <ArrowUpRight size={14} />
              </Link>
            </nav>
          )}
          <Link
            href={admin ? "/pages/admin" : "/pages/login"}
            className="flex items-center gap-2 text-sm font-semibold text-slate-600"
          >
            <ArrowLeft size={16} />
            {admin ? "Admin dashboard" : "Back to Lan’s Hub"}
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-6xl space-y-7 px-5 py-8 md:py-12">
        {children}
      </div>
      {!admin && (
        <footer className="vote-footer">
          <span className="vote-footer-brand">
            <Sparkles size={15} />A little support. A bigger possibility.
          </span>
          <span>Powered by Lan&apos;s Hub</span>
        </footer>
      )}
    </main>
  );
}

export function Notice({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <div
      role={error ? "alert" : "status"}
      className={`rounded-2xl border p-4 text-sm ${error ? "border-red-200 bg-red-50 text-red-800" : "border-indigo-200 bg-indigo-50 text-indigo-900"}`}
    >
      {children}
    </div>
  );
}

export function ShareLink({
  slug,
  candidateId,
  compact = false,
}: {
  slug: string;
  candidateId?: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  async function copy() {
    const url = new URL(
      `/pages/votes/${encodeURIComponent(slug)}`,
      window.location.origin,
    );
    if (candidateId) url.searchParams.set("candidate", candidateId);
    try {
      await navigator.clipboard.writeText(url.href);
      setCopied(true);
      setError("");
    } catch {
      setError(`Copy this link: ${url.href}`);
    }
  }
  return (
    <div className="vote-share">
      <button
        type="button"
        className={`${secondary} vote-share-button ${compact ? "is-compact" : ""}`}
        onClick={copy}
        aria-label={candidateId ? "Copy candidate link" : "Copy poll link"}
        title={candidateId ? "Share candidate" : "Share poll"}
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
        {!compact &&
          (copied
            ? "Link copied"
            : candidateId
              ? "Share candidate"
              : "Share poll")}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? "Link copied to clipboard" : ""}
      </span>
      {error && (
        <p aria-live="polite" className="mt-2 break-all text-sm text-slate-600">
          {error}
        </p>
      )}
    </div>
  );
}
