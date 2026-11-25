"use client";

import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Braces,
  FilePlus2,
  Folder,
  GitBranch,
  Library,
  ListChecks,
  Sparkles,
  Upload,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { blueprintName, blueprintPath } from "../config";
import { newProject, type Project } from "../core/model";
import { allNodes } from "../core/registry";
import { importProject, MAX_PROJECT_BYTES } from "../core/schema";
import { assignments, templates } from "../education";
import {
  download,
  type ProjectList,
  type ProjectSummary,
  projectStore,
  type SavedProject,
} from "../persistence";
import Automation from "./automation";
import { LoadingMessage, LoadingRows, StudioLoading } from "./loading";

const Editor = dynamic(() => import("./editor"), {
  ssr: false,
  loading: () => (
    <StudioLoading editor label="Preparing the Blueprint editor…" />
  ),
});
const tabs = [
  { id: "", label: "Overview", icon: GitBranch },
  { id: "projects", label: "My projects", icon: Folder },
  { id: "learn", label: "Learning centre", icon: BookOpen },
  { id: "assignments", label: "Assignments", icon: ListChecks },
  { id: "templates", label: "Examples", icon: Library },
  { id: "docs", label: "Nodes", icon: Braces },
  { id: "automation", label: "AI Automation", icon: Sparkles },
];
const url = (section: string) =>
  section ? `${blueprintPath}/${section}` : blueprintPath;
const date = (value: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(value),
  );

export default function Studio({
  section,
  projectId,
}: {
  section: string;
  projectId?: string;
}) {
  const router = useRouter();
  const [listing, setListing] = useState<ProjectList>();
  const [loaded, setLoaded] = useState<SavedProject>();
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [operation, setOperation] = useState("");
  const activeOperation = useRef(false);
  const [opening, startOpening] = useTransition();
  const busy = !!operation || opening;
  const [search, setSearch] = useState("");
  const [attempt, setAttempt] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const pendingCreate = useRef<{ id: string; project: Project } | undefined>(
    undefined,
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: Retry refreshes the same route.
  useEffect(() => {
    const controller = new AbortController();
    setLoadError("");
    setListing(undefined);
    setLoaded(undefined);
    Promise.all([
      projectStore.list(controller.signal),
      projectId ? projectStore.load(projectId, controller.signal) : undefined,
    ])
      .then(([list, saved]) => {
        if (controller.signal.aborted) return;
        setListing(list);
        setLoaded(saved);
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setLoadError(
            (error as Error).message || "Projects could not be loaded.",
          );
      });
    return () => {
      controller.abort();
    };
  }, [projectId, attempt]);

  async function perform(
    label: string,
    action: () => Promise<void>,
    retry = false,
  ) {
    if (activeOperation.current || opening) return;
    activeOperation.current = true;
    if (!retry) pendingCreate.current = undefined;
    setError("");
    setOperation(label);
    try {
      await action();
    } catch (error) {
      setError(
        (error as Error).message ||
          "The project action could not be completed.",
      );
    } finally {
      activeOperation.current = false;
      setOperation("");
    }
  }

  async function create(project?: Project) {
    const request = project
      ? { id: crypto.randomUUID(), project }
      : pendingCreate.current;
    if (!request) return;
    pendingCreate.current = request;
    const saved = await projectStore.create(request.id, request.project);
    pendingCreate.current = undefined;
    startOpening(() => router.push(`${blueprintPath}/editor/${saved.id}`));
  }

  async function remove(item: ProjectSummary) {
    if (busy || !window.confirm(`Delete “${item.title}”?`)) return;
    await perform("Deleting project…", async () => {
      await projectStore.remove(item.id, item.revision);
      setListing(
        (list) =>
          list && {
            ...list,
            projects: list.projects.filter((entry) => entry.id !== item.id),
          },
      );
    });
  }

  async function exportProject(item: ProjectSummary) {
    await perform("Preparing project export…", async () => {
      const { project } = await projectStore.load(item.id);
      download(
        `${project.title}.lanbp`,
        JSON.stringify(project),
        "application/json",
      );
    });
  }

  const controlsUnavailable = busy || !listing;
  const actions = (
    <>
      <button
        className="bp-primary"
        type="button"
        disabled={controlsUnavailable}
        onClick={() =>
          void perform("Creating Blueprint…", () => create(newProject()))
        }
      >
        <FilePlus2 size={16} /> New Blueprint
      </button>
      <button
        type="button"
        disabled={controlsUnavailable}
        onClick={() => input.current?.click()}
      >
        <Upload size={16} /> Import .lanbp
      </button>
      <input
        ref={input}
        hidden
        type="file"
        accept=".lanbp,application/json"
        aria-label="Import Blueprint project"
        onChange={async (event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (!file) return;
          await perform("Importing Blueprint…", async () => {
            if (file.size > MAX_PROJECT_BYTES)
              throw new Error("This Blueprint file is too large.");
            await create(importProject(await file.text()));
          });
        }}
      />
    </>
  );

  const loadFailure = loadError && (
    <section className="bp-load-error">
      <h2>
        {projectId
          ? "Could not open this project"
          : "Could not load your Blueprint projects"}
      </h2>
      <p role="alert">{loadError}</p>
      <div className="bp-actions">
        <button
          className="bp-primary"
          type="button"
          onClick={() => {
            setLoadError("");
            setAttempt((value) => value + 1);
          }}
        >
          Try again
        </button>
        {projectId && (
          <Link className="bp-button" href={url("projects")}>
            My projects
          </Link>
        )}
        <Link className="bp-button bp-primary" href="/pages/login">
          Student sign-in
        </Link>
      </div>
    </section>
  );
  if (projectId) {
    if (loadFailure)
      return (
        <main className="bp-studio">
          <div className="bp-home">{loadFailure}</div>
        </main>
      );
    if (listing && loaded)
      return (
        <Editor key={projectId} saved={loaded} accountId={listing.accountId} />
      );
    return <StudioLoading editor label="Loading your project…" />;
  }

  const list =
    (section === "projects"
      ? listing?.projects
      : listing?.projects.slice(0, 4)) ?? [];
  const projects = (
    <>
      {list.length ? (
        <ul className="bp-list">
          {list.map((item) => (
            <li key={item.id}>
              <Link className="bp-row-link" href={url(`editor/${item.id}`)}>
                <Folder size={17} />
                <span>
                  <strong>{item.title}</strong>
                  <small>Edited {date(item.updatedAt)}</small>
                </span>
                <ArrowUpRight size={15} />
              </Link>
              {section === "projects" && (
                <div className="bp-actions">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void perform("Duplicating project…", async () => {
                        const { project } = await projectStore.load(item.id);
                        await create({
                          ...project,
                          title: `${project.title.slice(0, 92)} (copy)`,
                        });
                      })
                    }
                  >
                    Duplicate
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void exportProject(item)}
                  >
                    Export
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void remove(item)}
                  >
                    Delete
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="bp-empty">Your saved projects will appear here.</p>
      )}
    </>
  );
  const examples = (
    <ul className="bp-list">
      {(section === "templates" ? templates : templates.slice(0, 3)).map(
        (example) => (
          <li key={example.id}>
            <span>
              <strong>{example.title}</strong>
              <small>{example.concept}</small>
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void perform("Creating project from example…", () =>
                  create(example.build()),
                )
              }
            >
              Use example <ArrowUpRight size={14} />
            </button>
          </li>
        ),
      )}
    </ul>
  );

  return (
    <main className="bp-studio">
      <div className="bp-home">
        <Link className="bp-back" href="/pages/student">
          <ArrowLeft size={15} /> Student portal
        </Link>
        <header className="bp-home-title">
          <div>
            <h1>{blueprintName}</h1>
            <p>
              Build visual programs, run them, and read the JavaScript they
              generate.
            </p>
          </div>
          <div className="bp-actions">{actions}</div>
        </header>
        <nav className="bp-tabs" aria-label="Blueprint Studio">
          {tabs.map(({ id, label, icon: Icon }) => (
            <Link
              key={id}
              href={url(id)}
              aria-current={section === id ? "page" : undefined}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </nav>
        {(opening || operation) && (
          <LoadingMessage>
            {opening ? "Opening the editor…" : operation}
          </LoadingMessage>
        )}
        {error && (
          <div className="bp-notice" role="alert">
            {error}
            {pendingCreate.current && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void perform(
                    "Retrying project creation…",
                    () => create(),
                    true,
                  )
                }
              >
                Retry creation
              </button>
            )}
          </div>
        )}
        {loadFailure}
        {!listing && !loadError && (
          <LoadingRows label="Loading your Blueprint projects…" />
        )}
        {listing && !section && (
          <div className="bp-home-grid">
            <section>
              <div className="bp-section-title">
                <h2>Recent projects</h2>
                {list[0] && (
                  <Link href={url(`editor/${list[0].id}`)}>
                    Continue latest <ArrowUpRight size={14} />
                  </Link>
                )}
              </div>
              {projects}
            </section>
            <section>
              <div className="bp-section-title">
                <h2>Start from an example</h2>
                <Link href={url("templates")}>
                  All examples <ArrowUpRight size={14} />
                </Link>
              </div>
              {examples}
            </section>
            <section>
              <div className="bp-section-title">
                <h2>Practice programming</h2>
              </div>
              <p>
                Work through the learning guide, then check your understanding
                with three introductory assignments.
              </p>
              <div className="bp-actions">
                <Link className="bp-button" href={url("learn")}>
                  Open guide
                </Link>
                <Link className="bp-button" href={url("assignments")}>
                  View assignments
                </Link>
              </div>
            </section>
          </div>
        )}
        {listing && section === "projects" && (
          <section>
            <h2>My projects</h2>
            {projects}
          </section>
        )}
        {listing && section === "templates" && (
          <section>
            <h2>Example projects</h2>
            {examples}
          </section>
        )}
        {listing && section === "learn" && (
          <section className="bp-reading">
            <h2>Programming with Blueprints</h2>
            <h3>1. Connect an event</h3>
            <p>
              Add Print and connect On Start’s Next pin to Print’s In pin. White
              wires decide what runs next.
            </p>
            <h3>2. Send a value</h3>
            <p>
              Connect a String or Number output to Print’s Value input. A data
              wire overrides the default you entered in Properties.
            </p>
            <h3>3. Make a decision</h3>
            <p>
              Connect a comparison to Branch’s Condition. Put one action on True
              and another on False. Use Next for anything that runs after either
              path.
            </p>
            <h3>4. Repeat a step</h3>
            <p>
              Connect actions to a loop’s Body. A For Loop counts from Start up
              to the exclusive End. Its Index is available inside Body.
            </p>
            <h3>5. Debug your work</h3>
            <p>
              Use Debug to pause before the first action. Step Into enters loops
              and function bodies. Step Over runs the current action before
              pausing at its next sibling.
            </p>
            <Link className="bp-button bp-primary" href={url("assignments")}>
              Try an assignment <ArrowUpRight size={16} />
            </Link>
          </section>
        )}
        {listing && section === "assignments" && (
          <section>
            <h2>Introductory assignments</h2>
            <p>Run your graph in the editor to check your output.</p>
            <ul className="bp-list">
              {assignments.map((task) => (
                <li key={task.id}>
                  <span>
                    <strong>{task.title}</strong>
                    <small>{task.description}</small>
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void perform("Preparing your assignment…", () =>
                        create({
                          ...newProject(task.title),
                          assignmentId: task.id,
                        }),
                      )
                    }
                  >
                    Start assignment <ArrowUpRight size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {listing && section === "docs" && (
          <section>
            <h2>Node documentation</h2>
            <input
              className="bp-search"
              aria-label="Search node documentation"
              placeholder="Search nodes or categories"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <dl className="bp-node-docs">
              {allNodes()
                .filter((node) =>
                  `${node.label} ${node.category}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                )
                .map((node) => (
                  <div key={node.id}>
                    <dt>
                      {node.label} <small>{node.category}</small>
                    </dt>
                    <dd>{node.description}</dd>
                  </div>
                ))}
            </dl>
          </section>
        )}
        {listing && section === "automation" && <Automation />}
      </div>
    </main>
  );
}
