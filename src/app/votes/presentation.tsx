import { ArrowUpRight, Check, Sparkles, Vote } from "lucide-react";
import type { PollStatus } from "./types";

export function PollBadge({ status }: { status: PollStatus }) {
  const labels = {
    OPEN: "Voting open",
    SCHEDULED: "Coming soon",
    CLOSED: "Voting closed",
    DRAFT: "Draft",
  };
  return (
    <span className={`vote-status vote-status-${status.toLowerCase()}`}>
      <span />
      {labels[status]}
    </span>
  );
}

export function BallotArtwork() {
  return (
    <div className="vote-ballot-art" aria-hidden="true">
      <div className="vote-art-orbit orbit-one" />
      <div className="vote-art-orbit orbit-two" />
      <div className="vote-art-spark spark-one">
        <Sparkles size={26} />
      </div>
      <div className="vote-art-spark spark-two">
        <ArrowUpRight size={25} />
      </div>
      <div className="vote-ballot-card">
        <div className="vote-ballot-card-top">
          <Vote size={23} />
          <span>THE PEOPLE&apos;S CHOICE</span>
        </div>
        <div className="vote-ballot-symbol">
          <Check size={50} strokeWidth={2.5} />
        </div>
        <span className="vote-ballot-line long" />
        <span className="vote-ballot-line" />
        <div className="vote-ballot-card-bottom">
          <span>YOUR VOICE MATTERS</span>
          <ArrowUpRight size={20} />
        </div>
      </div>
      <div className="vote-art-sticker">
        <span>
          <Check size={16} />
        </span>
        Small vote. Big energy.
      </div>
    </div>
  );
}

export function VotingSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <section
      aria-busy="true"
      aria-label="Loading voting information"
      className="vote-poll-grid"
    >
      {["first", "second", "third"].slice(0, cards).map((name) => (
        <div className="vote-skeleton-card" key={name}>
          <div className="vote-skeleton-art" />
          <div className="vote-skeleton-body">
            <span />
            <span />
            <span />
          </div>
        </div>
      ))}
    </section>
  );
}
