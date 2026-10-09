import { useState } from "react";
import { ArrowUpRight, Check, Download, RefreshCw } from "lucide-react";
import type { Config, NotionTarget, Project } from "../types";
import { download, message, request, saveBlob } from "../api";

export function NotionPanel({
  project,
  config,
  save,
}: {
  project: Project;
  config: Config;
  save: (target: NotionTarget, projectId: string) => void;
}) {
  const [parent, setParent] = useState("");
  const [database, setDatabase] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const ready =
    project.assessments.length > 0 &&
    project.assessments.every((item) => item.reviewed);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      await action();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="notion-grid">
      <section className="panel">
        <div className="notion-icon">N</div>
        <span className="eyebrow">YOUR SEMESTER, WHERE YOU WORK</span>
        <h2>Send it to Notion.</h2>
        <p className="muted">
          One database. A semester calendar, a deadlines table, and a study
          plan. Repeat syncs update the same entries.
        </p>
        {!config.notion_configured && (
          <div className="notice">
            Set NOTION_TOKEN in the backend .env file and restart. In Notion,
            share your parent page with that connection and grant read, insert
            and update access.
          </div>
        )}
        {project.notion ? (
          <>
            <div className="connection">
              <Check size={19} />
              <div>
                <strong>Database connected</strong>
                <small>{project.notion.database_id}</small>
              </div>
              <a
                className="icon-button"
                href={`https://www.notion.so/${project.notion.database_id.replaceAll("-", "")}`}
                target="_blank"
                rel="noreferrer"
                aria-label="Open Notion database"
              >
                <ArrowUpRight size={20} />
              </a>
            </div>
            {!ready && (
              <p className="notice">
                Add and review every assessment before syncing.
              </p>
            )}
            <p className="small muted">
              Sync writes reviewed assessments, source excerpts and study blocks
              to this database. It updates app-managed fields, preserves “Done”,
              and marks removed items as superseded. Save a project backup to
              reconnect later.
            </p>
            <button
              className="button primary"
              disabled={busy || !ready || !config.notion_configured}
              onClick={() =>
                run(async () => {
                  const result = await request<{
                    created: number;
                    updated: number;
                    superseded: number;
                    warnings: string[];
                    error: string | null;
                  }>("/notion/sync", project);
                  setStatus(
                    `${result.created} created · ${result.updated} updated · ${result.superseded} superseded. ${result.warnings.join(" ")}`,
                  );
                  if (result.error)
                    setError(
                      `Sync stopped after the completed changes above. ${result.error} Retry to continue safely.`,
                    );
                })
              }
            >
              <RefreshCw size={17} className={busy ? "spin" : ""} />
              {busy ? "Syncing…" : "Sync to Notion"}
            </button>
          </>
        ) : (
          <>
            <label>
              Parent page link or ID
              <input
                placeholder="https://www.notion.so/your-page…"
                value={parent}
                onChange={(e) => setParent(e.target.value)}
              />
            </label>
            {config.parent_configured && (
              <p className="small muted">
                Leave blank to use the parent page configured on the backend.
              </p>
            )}
            <button
              className="button primary"
              disabled={
                busy ||
                !config.notion_configured ||
                (!parent && !config.parent_configured)
              }
              onClick={() =>
                run(async () => {
                  const target = await request<NotionTarget>("/notion/create", {
                    project,
                    parent_page: parent,
                  });
                  save(target, project.id);
                  setStatus(
                    "Database created. Sync when your assessments are reviewed.",
                  );
                })
              }
            >
              {busy ? "Connecting…" : "Create semester database"}
            </button>
            <details className="reconnect">
              <summary>Reconnect an existing Crunch Week database</summary>
              <p className="small muted">
                Restore the original project backup first to preserve its
                identity and avoid duplicates.
              </p>
              <label>
                Database link or ID
                <input
                  value={database}
                  onChange={(e) => setDatabase(e.target.value)}
                />
              </label>
              <button
                className="button secondary"
                disabled={busy || !database || !config.notion_configured}
                onClick={() =>
                  run(async () => {
                    const target = await request<NotionTarget>(
                      "/notion/connect",
                      { database },
                    );
                    save(target, project.id);
                    setStatus("Connected.");
                  })
                }
              >
                Connect database
              </button>
            </details>
          </>
        )}
        {busy && (
          <p role="status" className="muted small">
            Notion limits request speed. Larger plans may take a few minutes.
            Keep this tab open.
          </p>
        )}
        {status && (
          <p role="status" className="notice success-notice">
            {status}
          </p>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </section>
      <section className="panel exports">
        <span className="eyebrow">TAKE YOUR PLAN WITH YOU</span>
        <h2>Good plans travel.</h2>
        <p className="muted">No integration needed for these downloads.</p>
        <button
          className="export-card"
          disabled={busy || !ready}
          onClick={() => run(() => download("ics", project))}
        >
          <CalendarIcon />
          <span>
            <strong>Calendar (.ics)</strong>
            <small>Reviewed deadlines + study blocks</small>
          </span>
          <Download size={18} />
        </button>
        <button
          className="export-card"
          disabled={busy}
          onClick={() => run(() => download("csv", project))}
        >
          <span className="file-symbol">CSV</span>
          <span>
            <strong>Assessment spreadsheet</strong>
            <small>All entries, including review status</small>
          </span>
          <Download size={18} />
        </button>
        <button
          className="export-card"
          disabled={busy}
          onClick={() =>
            saveBlob(
              new Blob([JSON.stringify(project, null, 2)], {
                type: "application/json",
              }),
              "crunch-week-project.json",
            )
          }
        >
          <span className="file-symbol">{`{ }`}</span>
          <span>
            <strong>Project backup</strong>
            <small>Restore edits, settings and Notion IDs</small>
          </span>
          <Download size={18} />
        </button>
        <p className="small muted">
          Calendar files are snapshots. Re-import behavior varies by calendar
          app; replace the old imported calendar when rebuilding. Backups
          contain assessment details and excerpts, never API keys.
        </p>
      </section>
    </div>
  );
}

function CalendarIcon() {
  return <span className="file-symbol">ICS</span>;
}
