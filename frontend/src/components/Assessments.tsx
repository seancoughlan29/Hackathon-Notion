import { useState } from "react";
import { Check, FileSearch, Pencil, Plus, Search, Trash2 } from "lucide-react";
import type { Assessment, Project } from "../types";
import { dateLabel, moduleColor } from "../utils";

export function Assessments({
  project,
  edit,
  add,
  remove,
  approve,
  warnings,
}: {
  project: Project;
  edit: (item: Assessment) => void;
  add: () => void;
  remove: (id: string) => void;
  approve: () => void;
  warnings: string[];
}) {
  const [search, setSearch] = useState("");
  const [onlyUnreviewed, setOnlyUnreviewed] = useState(false);
  const items = project.assessments.filter(
    (item) =>
      `${item.title} ${item.module}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (!onlyUnreviewed || !item.reviewed),
  );
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">TRUST, THEN VERIFY</span>
          <h2>Every deadline. In one place.</h2>
        </div>
        <button className="button primary" onClick={add}>
          <Plus size={17} />
          Add assessment
        </button>
      </div>
      <p className="muted">
        Open an assessment to check its source, correct the details, and
        estimate your remaining work.
      </p>
      <div className="table-toolbar">
        <label className="search">
          <Search size={17} />
          <input
            aria-label="Search assessments"
            placeholder="Search modules or assessments…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={onlyUnreviewed}
            onChange={(e) => setOnlyUnreviewed(e.target.checked)}
          />
          Needs review only
        </label>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Assessment / module</th>
              <th>Deadline</th>
              <th>Weight</th>
              <th>Work left</th>
              <th>Review</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <button className="table-title" onClick={() => edit(item)}>
                    {item.title}
                  </button>
                  <span className="module-label">
                    <i
                      className="dot"
                      style={{ background: moduleColor(item.module) }}
                    />
                    {item.module}
                  </span>
                </td>
                <td>
                  {dateLabel(item.due_date)}
                  <small className="block muted">
                    {item.due_time?.slice(0, 5) ||
                      (item.due_date ? "Time not specified" : "Check source")}
                  </small>
                </td>
                <td>
                  {item.weight_percent === null
                    ? "Unknown"
                    : `${item.weight_percent}%`}
                </td>
                <td>{item.effort_minutes / 60}h</td>
                <td>
                  <span
                    className={`badge ${item.reviewed ? "success" : "warning"}`}
                  >
                    {item.reviewed ? (
                      <Check size={12} />
                    ) : (
                      <FileSearch size={12} />
                    )}
                    {item.reviewed ? "Reviewed" : "Check source"}
                  </span>
                </td>
                <td>
                  <div className="row-actions">
                    <button
                      className="icon-button"
                      aria-label={`Edit ${item.title}`}
                      onClick={() => edit(item)}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      className="icon-button danger"
                      aria-label={`Remove ${item.title}`}
                      onClick={() => remove(item.id)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!items.length && (
        <div className="empty-small">
          No assessments match. Upload a handbook or add one manually.
        </div>
      )}
      {project.assessments.some((item) => !item.reviewed) && (
        <div className="bulk-review">
          <p className="small muted">
            Already checked every entry against your handbooks?
          </p>
          <button className="button secondary" onClick={approve}>
            <Check size={16} />
            Mark all as reviewed
          </button>
        </div>
      )}
      {warnings.length > 0 && (
        <details className="notice">
          <summary>
            {warnings.length} detail{warnings.length > 1 ? "s" : ""} to check
          </summary>
          <ul>
            {warnings.map((warning, i) => (
              <li key={i}>{warning}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
