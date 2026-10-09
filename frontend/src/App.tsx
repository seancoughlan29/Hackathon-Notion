import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  CheckCheck,
  ChevronDown,
  Clock3,
  Download,
  FileText,
  LayoutDashboard,
  Leaf,
  Plus,
  RotateCcw,
  Settings2,
  Upload,
  X,
  Zap,
} from "lucide-react";
import type { Assessment, Config, PlanResponse, Project, Tab } from "./types";
import { message, request, saveBlob } from "./api";
import { Dashboard } from "./components/Dashboard";
import { Assessments } from "./components/Assessments";
import { AssessmentEditor } from "./components/AssessmentEditor";
import { SettingsEditor } from "./components/SettingsEditor";
import { UploadDialog } from "./components/UploadDialog";
import { StudyPlan } from "./components/StudyPlan";
import { NotionPanel } from "./components/NotionPanel";
import { dateLabel } from "./utils";

const STORAGE_KEY = "crunch-week-project-v1";
const nav = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "assessments", label: "Assessments", icon: FileText },
  { id: "study", label: "Study plan", icon: Clock3 },
  { id: "notion", label: "Notion & exports", icon: ArrowRight },
] as const;

export default function App() {
  const [project, setProject] = useState<Project | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [result, setResult] = useState<PlanResponse | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [modal, setModal] = useState<"settings" | "upload" | null>(null);
  const [editing, setEditing] = useState<Assessment | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [saved, setSaved] = useState(false);
  const restoreInput = useRef<HTMLInputElement>(null);
  const projectRef = useRef<Project | null>(null);

  function persist(next: Project) {
    projectRef.current = next;
    setProject(next);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSaved(true);
    } catch {
      setSaved(false);
      setError(
        "Browser storage is full or unavailable. Download a project backup to keep your changes.",
      );
    }
  }
  async function validateAndSave(next: Project) {
    persist(await request<Project>("/project/validate", next));
  }
  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        const [settings, fresh] = await Promise.all([
          request<Config>("/config"),
          request<Project>("/project/new"),
        ]);
        if (!active) return;
        setConfig(settings);
        let stored: string | null = null;
        try {
          stored = sessionStorage.getItem(STORAGE_KEY);
        } catch {
          /* Downloads remain available. */
        }
        if (stored) {
          try {
            const restored = await request<Project>(
              "/project/validate",
              JSON.parse(stored),
            );
            if (active) persist(restored);
            return;
          } catch {
            if (active)
              setError(
                "The saved tab project could not be restored. Import a project backup, or start a new semester.",
              );
          }
        }
        if (active) persist(fresh);
      } catch (err) {
        if (active)
          setError(
            `Cannot connect to the backend. Start FastAPI, then refresh. ${message(err)}`,
          );
      }
    }
    void initialize();
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!project) return;
    const controller = new AbortController();
    setPlanning(true);
    setResult(null);
    request<PlanResponse>("/plan", project, controller.signal)
      .then(setResult)
      .catch((err) => {
        if (!controller.signal.aborted) setError(message(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setPlanning(false);
      });
    return () => controller.abort();
  }, [project]);
  async function act(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }
  async function replaceWith(path: string) {
    if (
      project?.assessments.length &&
      !window.confirm(
        "Replace this tab’s project? Download a backup first if you want to keep it. Your Notion database will not be deleted.",
      )
    )
      return;
    await act(async () => {
      persist(await request<Project>(path));
      setTab("overview");
    });
  }
  function newAssessment() {
    setEditing({
      id: crypto.randomUUID(),
      module: "",
      title: "",
      kind: "Assignment",
      due_date: null,
      due_time: null,
      weight_percent: null,
      effort_minutes: 240,
      source_file: "Manual entry",
      source_page: null,
      evidence: "",
      notes: "",
      reviewed: false,
    });
  }
  if (!project || !config)
    return (
      <div className="loading-screen">
        <div className="brand-mark">
          <Zap />
        </div>
        <h1>Crunch Week</h1>
        <p role={error ? "alert" : "status"}>
          {error || "Making room for your semester…"}
        </p>
        {error && (
          <button
            className="button primary"
            onClick={() => window.location.reload()}
          >
            Retry connection
          </button>
        )}
      </div>
    );
  const count = project.assessments.filter((item) => !item.reviewed).length;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setTab("overview");
          }}
        >
          <span className="brand-mark">
            <Zap size={24} />
          </span>
          <span>
            crunch<span className="brand-light">week</span>
            <small>A LITTLE LESS LAST-MINUTE.</small>
          </span>
        </a>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <button
          className="semester-switch"
          onClick={() => setModal("settings")}
        >
          <span className="semester-icon">
            <CalendarDays size={19} />
          </span>
          <span>
            <strong>{project.name}</strong>
            <small>
              {dateLabel(project.settings.semester_start)} —{" "}
              {dateLabel(project.settings.semester_end)}
            </small>
          </span>
          <ChevronDown size={15} />
        </button>
        <nav aria-label="Main navigation">
          {nav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id)}
              aria-current={tab === id ? "page" : undefined}
            >
              <Icon size={19} />
              {label}
              {id === "assessments" && count > 0 && (
                <b className="nav-count">{count}</b>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <Leaf size={21} />
            <strong>
              Plan ahead.
              <br />
              Breathe a little.
            </strong>
            <p>Your semester is bigger than your busiest week.</p>
          </div>
          <button
            className="sidebar-action"
            onClick={() => setModal("settings")}
          >
            <Settings2 size={17} />
            Semester & availability
          </button>
          <div className="local-label">
            <i className="dot" />
            {saved ? "Saved in this tab" : "In-memory session"}
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div className="breadcrumb">
            Your workspace <span>/</span>{" "}
            <strong>{nav.find((item) => item.id === tab)?.label}</strong>
          </div>
          <div className="top-actions">
            <button
              className="icon-button"
              title="Download project backup"
              aria-label="Download project backup"
              onClick={() =>
                saveBlob(
                  new Blob([JSON.stringify(project, null, 2)], {
                    type: "application/json",
                  }),
                  "crunch-week-project.json",
                )
              }
            >
              <Download size={18} />
            </button>
            <button
              className="icon-button"
              title="Restore project backup"
              aria-label="Restore project backup"
              onClick={() => restoreInput.current?.click()}
            >
              <RotateCcw size={18} />
            </button>
            <span className="avatar" aria-label="Student workspace">
              CW
            </span>
          </div>
        </header>
        <input
          className="sr-only"
          type="file"
          ref={restoreInput}
          accept=".json"
          aria-label="Project backup file"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            if (file.size > 2_000_000) {
              setError("Project backups must be smaller than 2 MB.");
              return;
            }
            if (
              project.assessments.length &&
              !window.confirm("Replace this tab’s project with the backup?")
            )
              return;
            await act(async () => {
              await validateAndSave(JSON.parse(await file.text()));
              setTab("overview");
            });
          }}
        />
        <div className="content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {tab === "overview"
                  ? "LESS PANIC. MORE POSSIBILITY."
                  : "CRUNCH WEEK / YOUR SEMESTER"}
              </span>
              <h1>
                {tab === "overview"
                  ? "See the busy weeks coming."
                  : tab === "assessments"
                    ? "The details, sorted."
                    : tab === "study"
                      ? "Make the work feel smaller."
                      : "From a plan to your everyday."}
              </h1>
              <p>
                {tab === "overview"
                  ? "Turn scattered deadlines into a semester you can handle."
                  : "A little clarity now. A lot less scrambling later."}
              </p>
            </div>
            <button
              className="button primary"
              disabled={busy}
              onClick={() => {
                setModal("upload");
                setTab("assessments");
              }}
            >
              <Upload size={17} />
              Upload handbooks
            </button>
          </div>
          {error && (
            <div className="error global-error" role="alert">
              <span>{error}</span>
              <button
                className="icon-button"
                aria-label="Dismiss error"
                onClick={() => setError("")}
              >
                <X size={17} />
              </button>
            </div>
          )}
          {project.demo && (
            <div className="demo-banner">
              <span>
                <Sparkle />
                You're exploring a synthetic demo. These are not real university
                deadlines.
              </span>
              <button
                disabled={busy}
                onClick={() => replaceWith("/project/new")}
              >
                Start my semester <ArrowRight size={14} />
              </button>
            </div>
          )}
          {!project.assessments.length && tab === "overview" ? (
            <>
              <section className="welcome panel">
                <div>
                  <span className="badge success">YOUR NEXT HEAD START</span>
                  <h2>
                    Three handbooks.
                    <br />
                    One clear semester.
                  </h2>
                  <p>
                    Let AI find the deadlines. Check the details. See the crunch
                    weeks and give your future self a plan.
                  </p>
                  <div className="welcome-actions">
                    <button
                      className="button primary"
                      onClick={() => setModal("upload")}
                    >
                      <Upload size={17} />
                      Upload your first handbook
                    </button>
                    <button
                      className="button secondary"
                      disabled={busy}
                      onClick={() => replaceWith("/demo")}
                    >
                      Explore the demo <ArrowRight size={17} />
                    </button>
                  </div>
                  <button className="text-link" onClick={newAssessment}>
                    <Plus size={15} />
                    Or add an assessment manually
                  </button>
                </div>
                <div className="welcome-art" aria-hidden="true">
                  <div className="art-paper">
                    <span>YOUR SEMESTER</span>
                    <b>You've got this.</b>
                    <div className="art-bars">
                      {[32, 48, 27, 80, 42, 56, 31, 98, 61, 36].map(
                        (height, i) => (
                          <i style={{ height: `${height}%` }} key={i} />
                        ),
                      )}
                    </div>
                    <small>A plan before the pile-up.</small>
                  </div>
                  <div className="art-tag">
                    <CheckCheck size={19} />A little more breathing room.
                  </div>
                </div>
              </section>
              <div className="steps">
                {[
                  ["01", "Upload", "Bring your module outlines together."],
                  ["02", "Review", "Check the dates against the source."],
                  [
                    "03",
                    "Make a plan",
                    "Find room for work before it piles up.",
                  ],
                ].map(([n, title, copy]) => (
                  <div key={n}>
                    <span>{n}</span>
                    <h3>{title}</h3>
                    <p>{copy}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              {planning && (
                <p className="planning" role="status">
                  <span className="spinner" />
                  Updating your plan…
                </p>
              )}
              {tab === "overview" && result && (
                <Dashboard
                  key={project.id}
                  project={project}
                  result={result}
                  navigate={setTab}
                  edit={setEditing}
                />
              )}
              {tab === "assessments" && (
                <Assessments
                  project={project}
                  warnings={result?.warnings ?? []}
                  edit={setEditing}
                  add={newAssessment}
                  remove={(id) => {
                    if (
                      window.confirm(
                        "Remove this assessment? Its study blocks will be rebuilt.",
                      )
                    )
                      void act(() =>
                        validateAndSave({
                          ...project,
                          assessments: project.assessments.filter(
                            (item) => item.id !== id,
                          ),
                        }),
                      );
                  }}
                  approve={() => {
                    if (
                      window.confirm(
                        "Have you checked every assessment’s date, time and weighting against its official source? Unknown dates will stay unscheduled.",
                      )
                    )
                      void act(() =>
                        validateAndSave({
                          ...project,
                          assessments: project.assessments.map((item) => ({
                            ...item,
                            reviewed: true,
                          })),
                        }),
                      );
                  }}
                />
              )}
              {tab === "study" && result && (
                <StudyPlan
                  project={project}
                  result={result}
                  settings={() => setModal("settings")}
                />
              )}
              {tab === "notion" && (
                <NotionPanel
                  project={project}
                  config={config}
                  save={(target, id) => {
                    const current = projectRef.current;
                    if (!current || current.id !== id)
                      throw new Error(
                        "The active project changed. Restore the original project backup to reconnect this database.",
                      );
                    persist({ ...current, notion: target });
                  }}
                />
              )}
            </>
          )}
          <footer>
            <span>
              <Leaf size={14} />
              Built for student life. Room for real life.
            </span>
            <span>
              Your time, thoughtfully planned · {project.settings.timezone}
            </span>
          </footer>
        </div>
      </main>
      {modal === "settings" && (
        <SettingsEditor
          project={project}
          close={() => setModal(null)}
          save={validateAndSave}
        />
      )}
      {modal === "upload" && (
        <UploadDialog
          project={project}
          config={config}
          close={() => {
            setModal(null);
            if (projectRef.current?.assessments.length) setTab("assessments");
          }}
          save={persist}
        />
      )}
      {editing && (
        <AssessmentEditor
          item={editing}
          close={() => setEditing(null)}
          save={async (item) => {
            const current = projectRef.current ?? project;
            const exists = current.assessments.some(
              (row) => row.id === item.id,
            );
            await validateAndSave({
              ...current,
              assessments: exists
                ? current.assessments.map((row) =>
                    row.id === item.id ? item : row,
                  )
                : [...current.assessments, item],
            });
          }}
        />
      )}
    </div>
  );
}
function Sparkle() {
  return <Zap size={14} />;
}
