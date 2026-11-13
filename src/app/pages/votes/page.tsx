"use client";

import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CircleHelp,
  Heart,
  RefreshCw,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  Users,
  Vote,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { VotingImage } from "@/app/votes/image";
import {
  BallotArtwork,
  PollBadge,
  VotingSkeleton,
} from "@/app/votes/presentation";
import { money, votingService } from "@/app/votes/service";
import type { Poll } from "@/app/votes/types";
import { Notice, secondary, VotingShell } from "@/app/votes/ui";

export default function VotesPage() {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setPolls(await votingService.polls());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load polls.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const filtered = polls.filter(
    (poll) =>
      poll.title.toLowerCase().includes(search.toLowerCase()) &&
      (filter === "all" || poll.status === filter),
  );
  return (
    <VotingShell>
      <section className="vote-hero">
        <div className="vote-hero-copy">
          <span className="vote-eyebrow">
            <Sparkles size={14} />
            The spotlight is yours to give
          </span>
          <h1>
            Big dreams.
            <br />
            Your <span>vote.</span>
          </h1>
          <p>
            Behind every candidate is a story worth supporting. Find your
            favourite, show some love, and help write their next chapter.
          </p>
          <div className="vote-hero-actions">
            <a href="#explore-polls" className="vote-button-dark">
              Find your favourite <ArrowDown size={17} />
            </a>
            <span>
              <ShieldCheck size={16} />
              Verified payments. Real support.
            </span>
          </div>
        </div>
        <BallotArtwork />
        <div className="vote-hero-foot">
          <span>
            <Heart size={15} />
            Made for the people you believe in.
          </span>
          <span>
            Choose. Support. Share. <ArrowUpRight size={15} />
          </span>
        </div>
      </section>
      <section
        className="vote-discover"
        id="explore-polls"
        aria-labelledby="polls-heading"
      >
        <div className="vote-section-heading">
          <div>
            <span className="vote-section-kicker">
              A little support goes a long way
            </span>
            <h2 id="polls-heading">
              Find your next favourite
              <span className="vote-heading-dot">.</span>
            </h2>
          </div>
          <label className="vote-search">
            <Search size={18} />
            <span className="sr-only">Search polls</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find a poll…"
              type="search"
            />
          </label>
        </div>
        <div className="vote-filterbar">
          <fieldset
            className="vote-filters"
            aria-label="Filter polls by status"
          >
            {[
              { value: "all", label: "All polls" },
              { value: "OPEN", label: "Voting open" },
              { value: "SCHEDULED", label: "Coming soon" },
              { value: "CLOSED", label: "Closed" },
            ].map((item) => (
              <button
                type="button"
                key={item.value}
                aria-pressed={filter === item.value}
                onClick={() => setFilter(item.value)}
              >
                {item.label}
                {item.value === "OPEN" && <span className="vote-filter-live" />}
              </button>
            ))}
          </fieldset>
          {!loading && !error && (
            <span className="vote-result-count" aria-live="polite">
              {filtered.length} {filtered.length === 1 ? "poll" : "polls"} to
              explore
            </span>
          )}
        </div>
        {loading ? (
          <VotingSkeleton />
        ) : error ? (
          <>
            <Notice error>{error}</Notice>
            <button
              type="button"
              className={`${secondary} mt-4`}
              onClick={load}
            >
              <RefreshCw size={15} />
              Try again
            </button>
          </>
        ) : filtered.length === 0 ? (
          <div className="vote-empty">
            <span className="vote-empty-icon">
              <Vote size={30} />
            </span>
            <h3>
              {search || filter !== "all"
                ? "No polls in this spotlight."
                : "The stage is getting ready."}
            </h3>
            <p>
              {search || filter !== "all"
                ? "Try a different search or explore all polls."
                : "New stories and candidates will appear here when a poll is published."}
            </p>
            {(search || filter !== "all") && (
              <button
                type="button"
                className={secondary}
                onClick={() => {
                  setSearch("");
                  setFilter("all");
                }}
              >
                Explore all polls <ArrowRight size={15} />
              </button>
            )}
          </div>
        ) : (
          <div className="vote-poll-grid">
            {filtered.map((poll, index) => (
              <Link
                key={poll.id}
                href={`/pages/votes/${encodeURIComponent(poll.slug)}`}
                className={`vote-poll-card vote-palette-${index % 3}`}
              >
                <div className="vote-poll-art">
                  <PollBadge status={poll.status} />
                  <VotingImage
                    src={poll.imageUrl}
                    alt={`Cover for ${poll.title}`}
                    className="vote-poll-cover"
                    fallback={
                      <div className="vote-poll-cover-fallback">
                        <div className="vote-poll-art-icon" aria-hidden="true">
                          <Vote size={42} strokeWidth={1.4} />
                        </div>
                        <span className="vote-poll-art-tag">
                          YOUR VOICE. THEIR MOMENT.
                        </span>
                      </div>
                    }
                  />
                  <span className="vote-poll-arrow">
                    <ArrowUpRight size={20} />
                  </span>
                </div>
                <div className="vote-poll-body">
                  <div className="vote-poll-meta">
                    <span>
                      <Users size={13} />
                      {poll.candidateCount} candidates
                    </span>
                    <span>
                      <CalendarDays size={13} />
                      {new Date(poll.closesAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <h3>{poll.title}</h3>
                  <p>{poll.description}</p>
                  <div className="vote-poll-bottom">
                    <span>
                      <strong>
                        {money(poll.votePriceMinor, poll.currency)}
                      </strong>
                      <small>per vote</small>
                    </span>
                    <span className="vote-poll-explore">
                      Meet the candidates <ArrowRight size={16} />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
      <section
        className="vote-how"
        id="how-it-works"
        aria-labelledby="how-heading"
      >
        <div className="vote-how-intro">
          <span className="vote-section-kicker">
            <CircleHelp size={13} />
            New around here?
          </span>
          <h2 id="how-heading">
            A few clicks.
            <br />A lot of possibility.
          </h2>
          <p>Supporting someone you believe in should feel this simple.</p>
        </div>
        <ol>
          {[
            {
              icon: Users,
              title: "Find your person",
              text: "Explore a poll and get to know the candidates.",
            },
            {
              icon: Check,
              title: "Make your move",
              text: "Choose your votes and complete payment. Votes count after verification.",
            },
            {
              icon: Share2,
              title: "Spread the love",
              text: "Copy their personal link and bring your people along.",
            },
          ].map((step, index) => (
            <li key={step.title}>
              <span className="vote-step-icon">
                <step.icon size={20} />
              </span>
              <span className="vote-step-number">0{index + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>
    </VotingShell>
  );
}
