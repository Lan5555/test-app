"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Edit2,
  Grid2X2,
  List,
  LoaderCircle,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import type { Users as Person } from "../../helpers/factories";
import { recordPage } from "./records-model";
import "./records.css";

interface RecordsProps {
  users: Person[];
  filtered: Person[];
  loading: boolean;
  error: string;
  search: string;
  scoreFilter: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
  view: "table" | "grid";
  selected: Set<number>;
  copiedId: number | null;
  busyId: number | null;
  page: number;
  size: number;
  onSearch: (value: string) => void;
  onFilter: (value: string) => void;
  onSort: (value: string) => void;
  onOrder: () => void;
  onView: (value: "table" | "grid") => void;
  onSelect: (id: number) => void;
  onSelectAll: () => void;
  onClear: () => void;
  onPage: (page: number) => void;
  onSize: (size: number) => void;
  onRefresh: () => void;
  onExport: () => void;
  onEdit: (user: Person) => void;
  onDelete: (user: Person) => void;
  onCopy: (user: Person) => void;
}

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase() || "?";
const scoreText = (score: number) =>
  Number.isFinite(score) ? `${Number(score.toFixed(1))}%` : "Unavailable";

export function StudentRecordsView(props: RecordsProps) {
  const {
    users,
    filtered,
    loading,
    error,
    search,
    scoreFilter,
    sortBy,
    sortOrder,
    view,
    selected,
    copiedId,
    busyId,
    size,
  } = props;
  const pagination = recordPage(filtered.length, props.page, size);
  const visible = filtered.slice(pagination.offset, pagination.offset + size);
  const scores = users.filter((user) => Number.isFinite(user.score));
  const average = scores.length
    ? scores.reduce((sum, user) => sum + user.score, 0) / scores.length
    : null;
  const attempts = users.reduce(
    (sum, user) =>
      sum +
      (Number.isFinite(user.codeInfo?.attempts) ? user.codeInfo.attempts : 0),
    0,
  );
  const allSelected =
    filtered.length > 0 && filtered.every((user) => selected.has(user.id));
  const partlySelected =
    !allSelected && filtered.some((user) => selected.has(user.id));
  const metrics = [
    {
      label: "Student records",
      value: users.length,
      note: "Loaded from your student directory",
    },
    {
      label: "Recorded attempts",
      value: attempts,
      note: "Across loaded student access records",
    },
    {
      label: "Average score",
      value: average === null ? "—" : scoreText(average),
      note: "Based on recorded student scores",
    },
    {
      label: "Highest score",
      value: scores.length
        ? scoreText(Math.max(...scores.map((user) => user.score)))
        : "—",
      note: "Across loaded student records",
    },
  ];
  function renderActions(user: Person) {
    return (
      <div className="records-row-actions">
        <button
          type="button"
          onClick={() => props.onEdit(user)}
          disabled={busyId === user.id}
          aria-label={`Edit ${user.name}`}
          title="Edit student"
        >
          <Edit2 size={15} />
        </button>
        <button
          type="button"
          className="records-delete"
          onClick={() => props.onDelete(user)}
          disabled={busyId === user.id}
          aria-label={`Delete ${user.name}`}
          title="Delete student"
        >
          {busyId === user.id ? (
            <LoaderCircle size={15} className="animate-spin" />
          ) : (
            <Trash2 size={15} />
          )}
        </button>
      </div>
    );
  }
  function renderCode(user: Person) {
    const code = user.codeInfo?.code;
    return (
      <div className="records-code">
        <code>{code || "Unassigned"}</code>
        {code && (
          <button
            type="button"
            onClick={() => props.onCopy(user)}
            aria-label={`Copy access code for ${user.name}`}
            title={copiedId === user.id ? "Copied" : "Copy access code"}
          >
            {copiedId === user.id ? <Check size={14} /> : <Copy size={14} />}
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="student-records-page">
      <div className="records-page-width">
        <Link href="/pages/admin" className="records-back">
          <ArrowLeft size={14} />
          Back to admin workspace
        </Link>
        <header className="records-heading">
          <div>
            <p className="records-eyebrow">
              <Users size={14} />
              People & progress
            </p>
            <h1>Your student directory.</h1>
            <p>
              A clearer view of your learners, their access, and their recorded
              results.
            </p>
          </div>
          <div className="records-heading-actions">
            <button
              type="button"
              className="records-button"
              onClick={props.onRefresh}
              disabled={loading}
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              {loading ? "Refreshing" : "Refresh"}
            </button>
            <button
              type="button"
              className="records-button records-button-primary"
              onClick={props.onExport}
              disabled={!users.length}
            >
              <Download size={15} />
              Export results
            </button>
          </div>
        </header>
        <section
          className="records-metrics"
          aria-label="Loaded student statistics"
        >
          {metrics.map((metric, index) => (
            <div key={metric.label}>
              <div>
                <span>{metric.label}</span>
                {index === 0 ? <Users size={16} /> : <BarChart3 size={16} />}
              </div>
              <strong>{(loading || error) && !users.length ? "—" : metric.value}</strong>
              <p>{metric.note}</p>
            </div>
          ))}
        </section>
        {error && (
          <div className="records-error" role="alert">
            <div>
              <strong>Student records could not be refreshed.</strong>
              <p>
                {error}{" "}
                {users.length > 0
                  ? "The last loaded records are shown below."
                  : ""}
              </p>
            </div>
            <button type="button" onClick={props.onRefresh} disabled={loading}>
              Try again
              <RefreshCw size={14} />
            </button>
          </div>
        )}
        <section
          className="records-directory"
          aria-labelledby="records-list-title"
        >
          <div className="records-directory-heading">
            <div>
              <h2 id="records-list-title">
                All students<span>{users.length}</span>
              </h2>
              <p>Search, select, and manage your student records.</p>
            </div>
            <Link href="/pages/admin/votes">
              Voting admin
              <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="records-toolbar">
            <label className="records-search">
              <Search size={17} />
              <span className="sr-only">Search students by name or email</span>
              <input
                type="search"
                value={search}
                onChange={(event) => props.onSearch(event.target.value)}
                placeholder="Search by name or email…"
              />
            </label>
            <div className="records-filters">
              <SlidersHorizontal size={15} aria-hidden="true" />
              <label>
                <span className="sr-only">Filter by score</span>
                <select
                  value={scoreFilter}
                  onChange={(event) => props.onFilter(event.target.value)}
                >
                  <option value="all">All scores</option>
                  <option value="90-100">90–100%</option>
                  <option value="75-89">75–89%</option>
                  <option value="60-74">60–74%</option>
                  <option value="40-59">40–59%</option>
                  <option value="0-39">Below 40%</option>
                  <option value="0">Zero score</option>
                </select>
              </label>
              <label>
                <span className="sr-only">Sort students</span>
                <select
                  value={sortBy}
                  onChange={(event) => props.onSort(event.target.value)}
                >
                  <option value="score">By score</option>
                  <option value="name">By name</option>
                  <option value="id">By record order</option>
                </select>
              </label>
              <button
                type="button"
                onClick={props.onOrder}
                aria-label={
                  sortOrder === "desc" ? "Sort ascending" : "Sort descending"
                }
                title={
                  sortOrder === "desc" ? "Sort ascending" : "Sort descending"
                }
              >
                {sortOrder === "desc" ? (
                  <ArrowDown size={16} />
                ) : (
                  <ArrowUp size={16} />
                )}
              </button>
              <fieldset
                className="records-view-toggle"
                aria-label="Directory view"
              >
                <button
                  type="button"
                  aria-label="Table view"
                  aria-pressed={view === "table"}
                  onClick={() => props.onView("table")}
                >
                  <List size={16} />
                </button>
                <button
                  type="button"
                  aria-label="Card view"
                  aria-pressed={view === "grid"}
                  onClick={() => props.onView("grid")}
                >
                  <Grid2X2 size={16} />
                </button>
              </fieldset>
            </div>
          </div>
          {selected.size > 0 && (
            <div className="records-selection">
              <span>
                <Check size={14} />
                {selected.size} student{selected.size === 1 ? "" : "s"} selected
              </span>
              <button type="button" onClick={props.onExport}>
                <Download size={14} />
                Export selection
              </button>
              <button type="button" onClick={props.onClear}>
                <X size={14} />
                Clear
              </button>
            </div>
          )}
          {loading && !users.length ? (
            <output className="records-loading" aria-live="polite">
              <LoaderCircle size={23} className="animate-spin" />
              <strong>Loading your student directory</strong>
              <p>Fetching current records and results.</p>
            </output>
          ) : filtered.length === 0 ? (
            <div className="records-empty">
              <span>
                <Users size={28} />
              </span>
              <h3>
                {error
                  ? "Your directory is unavailable"
                  : users.length
                    ? "No matching students"
                    : "Your directory is ready for students"}
              </h3>
              <p>
                {error
                  ? "Retry loading to view your records."
                  : users.length
                    ? "Try another name, email, or score range."
                    : "Registered students will appear here once they are available."}
              </p>
              {(search || scoreFilter !== "all") && (
                <button
                  type="button"
                  className="records-button"
                  onClick={() => {
                    props.onSearch("");
                    props.onFilter("all");
                  }}
                >
                  Reset filters
                </button>
              )}
            </div>
          ) : view === "table" ? (
            <div className="records-table-scroll">
              <table>
                <caption className="sr-only">
                  Student access and recorded results
                </caption>
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        aria-label="Select all filtered students"
                        checked={allSelected}
                        ref={(element) => {
                          if (element) element.indeterminate = partlySelected;
                        }}
                        onChange={props.onSelectAll}
                      />
                    </th>
                    <th>Student</th>
                    <th>Access code</th>
                    <th>Attempts</th>
                    <th>Recorded score</th>
                    <th className="records-actions-heading">Manage</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((user) => (
                    <tr
                      key={user.id}
                      data-selected={selected.has(user.id) || undefined}
                    >
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Select ${user.name}`}
                          checked={selected.has(user.id)}
                          onChange={() => props.onSelect(user.id)}
                        />
                      </td>
                      <td>
                        <div className="records-identity">
                          <span>{initials(user.name)}</span>
                          <div>
                            <strong>{user.name || "Unnamed student"}</strong>
                            <p>{user.email || "No email provided"}</p>
                          </div>
                        </div>
                      </td>
                      <td>{renderCode(user)}</td>
                      <td>
                        <span className="records-attempts">
                          {Number.isFinite(user.codeInfo?.attempts)
                            ? user.codeInfo.attempts
                            : "—"}
                        </span>
                      </td>
                      <td>
                        <div className="records-score">
                          <strong>{scoreText(user.score)}</strong>
                          <span>
                            <span
                              style={{
                                width: `${Number.isFinite(user.score) ? Math.max(0, Math.min(100, user.score)) : 0}%`,
                              }}
                            />
                          </span>
                        </div>
                      </td>
                      <td>{renderActions(user)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="records-card-grid">
              {visible.map((user) => (
                <article
                  key={user.id}
                  className="records-student-card"
                  data-selected={selected.has(user.id) || undefined}
                >
                  <div className="records-card-top">
                    <span>{initials(user.name)}</span>
                    <input
                      type="checkbox"
                      aria-label={`Select ${user.name}`}
                      checked={selected.has(user.id)}
                      onChange={() => props.onSelect(user.id)}
                    />
                  </div>
                  <h3>{user.name || "Unnamed student"}</h3>
                  <p>{user.email || "No email provided"}</p>
                  <dl>
                    <div>
                      <dt>Access code</dt>
                      <dd>{renderCode(user)}</dd>
                    </div>
                    <div>
                      <dt>Recorded score</dt>
                      <dd>{scoreText(user.score)}</dd>
                    </div>
                    <div>
                      <dt>Attempts</dt>
                      <dd>
                        {Number.isFinite(user.codeInfo?.attempts)
                          ? user.codeInfo.attempts
                          : "—"}
                      </dd>
                    </div>
                  </dl>
                  <footer>
                    <span>Student record</span>
                    {renderActions(user)}
                  </footer>
                </article>
              ))}
            </div>
          )}
          <footer className="records-pagination">
            <span>
              {pagination.start}–{pagination.end} of {filtered.length} student
              {filtered.length === 1 ? "" : "s"}
            </span>
            <div>
              <label>
                Per page
                <select
                  value={size}
                  onChange={(event) => props.onSize(Number(event.target.value))}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </label>
              <button
                type="button"
                onClick={() => props.onPage(pagination.page - 1)}
                disabled={pagination.page === 0 || loading}
                aria-label="Previous student page"
              >
                <ChevronLeft size={17} />
              </button>
              <span>
                {pagination.page + 1} / {pagination.pages}
              </span>
              <button
                type="button"
                onClick={() => props.onPage(pagination.page + 1)}
                disabled={pagination.page + 1 >= pagination.pages || loading}
                aria-label="Next student page"
              >
                <ChevronRight size={17} />
              </button>
            </div>
          </footer>
        </section>
      </div>
    </div>
  );
}
