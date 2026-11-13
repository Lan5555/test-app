"use client";

import {
  ArrowRight,
  ArrowUpRight,
  Award,
  BarChart3,
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileText,
  GraduationCap,
  Home,
  KeyRound,
  LayoutList,
  LogOut,
  Menu,
  Search,
  Settings2,
  ShieldCheck,
  Users,
  Vote,
} from "lucide-react";
import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import { readVotingAdminSession } from "../../votes/service";
import type { VotingAdminSession } from "../../votes/types";
import "./admin.css";
import { ThemePreferenceControl } from "../appearance/provider";

export function AdminSectionHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="admin-page-heading">
      <div>
        <p className="admin-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="admin-heading-actions">{children}</div>
    </div>
  );
}

export function AdminWelcome({
  name,
  passRate,
  reviews,
  onReviews,
  onCreate,
}: {
  name?: string;
  passRate: number;
  reviews: number;
  onReviews: () => void;
  onCreate: () => void;
}) {
  return (
    <section className="admin-welcome">
      <div className="admin-welcome-copy">
        <span className="admin-eyebrow">Your workspace, at a glance</span>
        <h1>Welcome back, {name?.split(" ")[0] || "Admin"}.</h1>
        <p>
          A little clarity for your day. Manage learning, support your students,
          and keep the next step in sight.
        </p>
        <div className="admin-welcome-actions">
          <button type="button" className="admin-primary" onClick={onCreate}>
            <BookOpen size={16} />
            Create a quiz
          </button>
          <button type="button" className="admin-secondary" onClick={onReviews}>
            Review submissions
            <ArrowUpRight size={15} />
          </button>
        </div>
        <span className="admin-welcome-date">
          <CalendarDays size={14} />
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </span>
      </div>
      <div className="admin-performance-card">
        <div>
          <span className="admin-eyebrow">Learning snapshot</span>
          <BarChart3 size={19} />
        </div>
        <strong>
          {Math.round(passRate)}
          <span>%</span>
        </strong>
        <p>Pass rate in loaded reviews</p>
        <div
          className="admin-performance-track"
          role="progressbar"
          aria-label="Pass rate in loaded reviews"
          aria-valuenow={Math.max(0, Math.min(100, passRate))}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span style={{ width: `${Math.max(0, Math.min(100, passRate))}%` }} />
        </div>
        <small>
          {reviews} submitted review{reviews === 1 ? "" : "s"} loaded
        </small>
      </div>
    </section>
  );
}

const sections = [
  { id: "overview", label: "Overview", icon: Home },
  { id: "quizzes", label: "Quizzes", icon: BookOpen },
  { id: "students", label: "Students", icon: Users },
  { id: "reviews", label: "Quiz reviews", icon: FileText },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "flyer", label: "Completion studio", icon: Award },
  { id: "settings", label: "Workspace settings", icon: Settings2 },
];
export function AdminSidebar({
  expanded,
  section,
  name,
  email,
  onToggle,
  onSelect,
  onLogout,
}: {
  expanded: boolean;
  section: string;
  name?: string;
  email?: string;
  onToggle: () => void;
  onSelect: (section: string) => void;
  onLogout: () => void;
}) {
  return (
    <>
      {expanded && (
        <button
          type="button"
          className="admin-mobile-backdrop"
          onClick={onToggle}
          aria-label="Close navigation"
        />
      )}
      <aside
        className={`admin-sidebar ${expanded ? "is-expanded" : ""}`}
        aria-label="Portal administration"
      >
        <div className="admin-sidebar-brand">
          <Link href="/pages/admin" aria-label="Lan's Hub admin">
            <span>
              <GraduationCap size={24} />
            </span>
            {expanded && (
              <strong>
                Lan&apos;s Hub<small>ADMIN WORKSPACE</small>
              </strong>
            )}
          </Link>
          <button
            type="button"
            onClick={onToggle}
            aria-label={expanded ? "Collapse navigation" : "Expand navigation"}
          >
            {expanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>
        <div className="admin-sidebar-scroll">
          {expanded && <p className="admin-nav-label">Learning & operations</p>}
          <nav>
            {sections.map((item) => (
              <button
                type="button"
                key={item.id}
                title={item.label}
                aria-current={section === item.id ? "page" : undefined}
                onClick={() => {
                  onSelect(item.id);
                  if (window.innerWidth < 1024) onToggle();
                }}
              >
                <item.icon size={18} />
                {expanded && <span>{item.label}</span>}
              </button>
            ))}
          </nav>
          {expanded && <p className="admin-nav-label">Dedicated workspaces</p>}
          <nav>
            <Link href="/pages/admin/votes" title="Voting administration">
              <Vote size={18} />
              {expanded && (
                <>
                  <span>Voting admin</span>
                  <KeyRound size={12} />
                </>
              )}
            </Link>
            <Link href="/pages/users" title="Student records">
              <LayoutList size={18} />
              {expanded && (
                <>
                  <span>Student records</span>
                  <ArrowUpRight size={13} />
                </>
              )}
            </Link>
          </nav>
          {expanded && (
            <div className="admin-sidebar-note">
              <ShieldCheck size={19} />
              <strong>
                One workspace.
                <br />A clearer direction.
              </strong>
              <p>Voting administration has its own secure sign-in.</p>
            </div>
          )}
        </div>
        <div className="admin-sidebar-profile">
          <span>{name?.charAt(0).toUpperCase() || "A"}</span>
          {expanded && (
            <div>
              <strong>{name || "Administrator"}</strong>
              <small>{email || "Portal admin session"}</small>
            </div>
          )}
          <button
            type="button"
            onClick={onLogout}
            aria-label="Sign out of portal admin"
            title="Sign out of portal admin"
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
    </>
  );
}

export function AdminTopbar({
  section,
  name,
  query,
  onQuery,
  onMenu,
}: {
  section: string;
  name?: string;
  query: string;
  onQuery: (value: string) => void;
  onMenu: () => void;
}) {
  const search = ["quizzes", "students", "reviews"].includes(section);
  return (
    <header className="admin-topbar">
      <div className="admin-topbar-context">
        <button
          type="button"
          className="admin-mobile-menu"
          onClick={onMenu}
          aria-label="Open navigation"
        >
          <Menu size={20} />
        </button>
        <span>Administration</span>
        <ChevronRight size={13} />
        <strong>
          {sections.find((item) => item.id === section)?.label || "Overview"}
        </strong>
      </div>
      <div className="admin-topbar-actions">
        {search && (
          <label className="admin-search">
            <Search size={16} />
            <span className="sr-only">Search {section}</span>
            <input
              type="search"
              value={query}
              onChange={(event) => onQuery(event.target.value)}
              placeholder={`Search ${section}…`}
            />
          </label>
        )}
        <Link className="admin-voting-shortcut" href="/pages/admin/votes">
          <Vote size={15} />
          <span>Voting admin</span>
          <ArrowUpRight size={13} />
        </Link>
        <span
          className="admin-topbar-avatar"
          title={name || "Portal administrator"}
        >
          {name?.charAt(0).toUpperCase() || "A"}
        </span>
      </div>
    </header>
  );
}

export function VotingAccessCard() {
  const [session, setSession] = useState<VotingAdminSession | null>(null);
  useEffect(() => {
    setSession(readVotingAdminSession());
  }, []);
  return (
    <section className="admin-access-card">
      <span className="admin-access-icon">
        <Vote size={25} />
      </span>
      <div>
        <p className="admin-eyebrow">Voting administration</p>
        <h3>A dedicated space for your polls.</h3>
        <p>
          {session
            ? `A voting session is saved${session.name ? ` for ${session.name}` : ""} in this tab.`
            : "Sign in with your voting admin password to manage polls, candidates, and verified totals."}
        </p>
      </div>
      <Link className="admin-primary" href="/pages/admin/votes">
        {session ? "Open voting admin" : "Sign in to voting"}
        <ArrowRight size={16} />
      </Link>
    </section>
  );
}

export function AdminSettings({
  name,
  email,
  compact,
  motion,
  onPreference,
  users,
  search,
  onSearch,
  onConfigure,
}: {
  name?: string;
  email?: string;
  compact: boolean;
  motion: boolean;
  onPreference: (key: "compactTables" | "reduceMotion", value: boolean) => void;
  users: { id: number; name: string; deadline: unknown }[];
  search: string;
  onSearch: (value: string) => void;
  onConfigure: () => void;
}) {
  const filtered = users.filter((user) =>
    user.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="admin-settings">
      <div className="admin-section-heading">
        <div>
          <p className="admin-eyebrow">Make this space work for you</p>
          <h1>Workspace settings.</h1>
          <p>
            Manage display preferences, session access, and assessment
            deadlines.
          </p>
        </div>
        <Settings2 size={29} />
      </div>
      <VotingAccessCard />
      <div className="admin-settings-grid">
        <section className="admin-card">
          <div className="admin-card-heading">
            <span>
              <Settings2 size={18} />
            </span>
            <h2>Display preferences</h2>
          </div>
          <ThemePreferenceControl />
          <label className="admin-preference">
            <span>
              <strong>Compact tables</strong>
              <small>Fit more student and review records on screen.</small>
            </span>
            <input
              type="checkbox"
              checked={compact}
              onChange={(event) =>
                onPreference("compactTables", event.target.checked)
              }
            />
          </label>
          <label className="admin-preference">
            <span>
              <strong>Reduce motion</strong>
              <small>
                Limit animations and transitions within this workspace.
              </small>
            </span>
            <input
              type="checkbox"
              checked={motion}
              onChange={(event) =>
                onPreference("reduceMotion", event.target.checked)
              }
            />
          </label>
          <p className="admin-settings-note">
            These display preferences are stored in this browser.
          </p>
        </section>
        <section className="admin-card">
          <div className="admin-card-heading">
            <span>
              <ShieldCheck size={19} />
            </span>
            <h2>Portal administrator</h2>
          </div>
          <dl className="admin-session-details">
            <div>
              <dt>Name</dt>
              <dd>{name || "Not provided"}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{email || "Not provided"}</dd>
            </div>
            <div>
              <dt>Sign-in</dt>
              <dd>Original portal admin credentials</dd>
            </div>
          </dl>
          <p className="admin-settings-note">
            The portal session and voting session are managed separately.
          </p>
        </section>
      </div>
      <section className="admin-card admin-deadline-card">
        <div className="admin-card-heading">
          <span>
            <CalendarDays size={19} />
          </span>
          <h2>Assessment deadlines</h2>
          <button type="button" className="admin-primary" onClick={onConfigure}>
            Configure deadlines
            <ArrowRight size={15} />
          </button>
        </div>
        <label className="admin-search">
          <Search size={16} />
          <span className="sr-only">Search student deadlines</span>
          <input
            type="search"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Find a student…"
          />
        </label>
        <div className="admin-deadline-list">
          {filtered.length ? (
            filtered.map((user) => (
              <div key={user.id}>
                <span>{user.name}</span>
                <strong>
                  {typeof user.deadline === "string" &&
                  Number.isFinite(Date.parse(user.deadline))
                    ? new Date(user.deadline).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "No deadline set"}
                </strong>
              </div>
            ))
          ) : (
            <p>No matching student records are loaded.</p>
          )}
        </div>
      </section>
    </div>
  );
}
