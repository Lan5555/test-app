"use client";

import {
  ArrowUpRight,
  CircleCheck,
  ReceiptText,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { money, votingService } from "@/app/votes/service";
import type { VoteReceipt } from "@/app/votes/types";
import { Notice, primary, secondary, VotingShell } from "@/app/votes/ui";

export default function VotePaymentPage() {
  const [receipt, setReceipt] = useState<VoteReceipt | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const check = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const id = new URLSearchParams(window.location.search).get("purchaseId");
      const token = id && sessionStorage.getItem(`vote-receipt:${id}`);
      if (!id || !token)
        throw new Error(
          "Open this receipt in the browser tab where you started payment. If that tab is unavailable, contact support with your provider payment reference.",
        );
      const result = await votingService.receipt(id, token);
      setReceipt(result);
      if (["PAID", "FAILED", "EXPIRED", "REFUNDED"].includes(result.status)) {
        // Clear only this purchase's attempt. Another poll/payment must remain intact.
        for (const key of Object.keys(sessionStorage)) {
          if (
            key.startsWith("vote-checkout:") &&
            sessionStorage.getItem(key) === id
          ) {
            sessionStorage.removeItem(
              `vote-attempt:${key.slice("vote-checkout:".length)}`,
            );
            sessionStorage.removeItem(key);
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to verify payment.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void check();
  }, [check]);
  return (
    <VotingShell>
      <section className="vote-receipt mx-auto max-w-xl space-y-6 p-8">
        <div
          className={`vote-receipt-icon ${!error && receipt?.status === "PAID" ? "is-paid" : ""}`}
        >
          {!error && receipt?.status === "PAID" ? (
            <CircleCheck size={34} />
          ) : (
            <ReceiptText size={32} />
          )}
        </div>
        <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">
          Payment receipt
        </p>
        <h1 className="text-3xl font-black">
          {!error && receipt?.status === "PAID"
            ? "Your votes are counted."
            : "Check your payment"}
        </h1>
        {loading && (
          <Notice>Checking the server for verified payment status…</Notice>
        )}
        {error && <Notice error>{error}</Notice>}
        {!error && receipt && (
          <>
            <Notice>
              {
                {
                  PENDING:
                    "Payment is still being verified. Check again shortly; do not pay again.",
                  PAID: "Payment verified and votes credited.",
                  FAILED:
                    "This payment failed. You can return to the poll and start a new purchase.",
                  EXPIRED:
                    "This unpaid checkout expired. You can start a new purchase.",
                  REVIEW:
                    "Payment needs review. Please contact support before making another payment.",
                  REFUNDED:
                    "This purchase has been refunded. Its votes are no longer counted.",
                }[receipt.status]
              }
            </Notice>
            <dl className="space-y-4 text-sm">
              {[
                ["Poll", receipt.pollTitle],
                ["Candidate", receipt.candidateName],
                ["Purchased votes", receipt.quantity],
                ["Credited votes", receipt.creditedVotes],
                ["Amount", money(receipt.amountMinor, receipt.currency)],
                ["Status", receipt.status],
                ["Reference", receipt.purchaseId],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex flex-wrap justify-between gap-2 border-b border-slate-100 pb-3"
                >
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="break-all font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className={primary}
            disabled={loading}
            onClick={check}
          >
            {loading ? "Checking…" : "Check again"}
          </button>
          <Link className={secondary} href="/pages/votes">
            Back to polls <ArrowUpRight size={15} />
          </Link>
        </div>
        <p className="vote-receipt-note">
          <ShieldCheck size={14} />
          Your status comes from verified payment records.
        </p>
      </section>
    </VotingShell>
  );
}
