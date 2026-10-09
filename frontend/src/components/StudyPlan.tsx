import { CalendarClock, Settings2 } from "lucide-react";
import type { PlanResponse, Project, StudyBlock } from "../types";
import { dateLabel, moduleColor } from "../utils";

export function StudyPlan({
  project,
  result,
  settings,
}: {
  project: Project;
  result: PlanResponse;
  settings: () => void;
}) {
  const groups = result.plan.blocks.reduce<Record<string, StudyBlock[]>>(
    (all, block) => {
      const day = block.start.slice(0, 10);
      (all[day] ??= []).push(block);
      return all;
    },
    {},
  );
  return (
    <>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">SMALL BLOCKS. MORE BREATHING ROOM.</span>
            <h2>A plan that fits your week.</h2>
          </div>
          <button className="button secondary" onClick={settings}>
            <Settings2 size={17} />
            Availability
          </button>
        </div>
        <p className="muted">
          {project.settings.daily_minutes / 60} hours per available day · up to{" "}
          {project.settings.block_minutes} minutes per block ·{" "}
          {project.settings.timezone}
        </p>
        <p className="small muted">
          Earlier deadlines get priority. Work is placed as late as it fits
          before deadline day, with {project.settings.buffer_days} extra clear
          day(s). Reduce “work left” as you finish; this is a suggested plan,
          not a live timetable.
        </p>
      </section>
      {result.plan.shortfalls.length > 0 && (
        <section className="panel shortfalls">
          <h2>Some work still needs room.</h2>
          <p>We haven't squeezed it into hours you don't have.</p>
          {result.plan.shortfalls.map((row) => (
            <div key={row.assessment_id} className="shortfall-row">
              <div>
                <strong>{row.label}</strong>
                <small>{row.reason}</small>
              </div>
              <span className="badge warning">
                {row.minutes / 60}h unscheduled
              </span>
            </div>
          ))}
        </section>
      )}
      {!!result.plan.warnings.length && (
        <details className="notice">
          <summary>Planning notes ({result.plan.warnings.length})</summary>
          <ul>
            {result.plan.warnings.map((warning, i) => (
              <li key={i}>{warning}</li>
            ))}
          </ul>
        </details>
      )}
      <div className="study-days">
        {Object.entries(groups).map(([day, blocks]) => (
          <section className="panel study-day" key={day}>
            <div className="panel-heading">
              <h3>
                <CalendarClock size={18} />
                {dateLabel(day, true)}
              </h3>
              <span className="muted small">
                {blocks.reduce((sum, block) => sum + block.minutes, 0) / 60}h
                total
              </span>
            </div>
            {blocks.map((block) => (
              <div
                className="study-block"
                key={block.id}
                style={{ borderLeftColor: moduleColor(block.module) }}
              >
                <span className="time-range">
                  {block.start.slice(11, 16)}—{block.end.slice(11, 16)}
                </span>
                <strong>{block.title}</strong>
                <small>{block.module}</small>
              </div>
            ))}
          </section>
        ))}
      </div>
      {!result.plan.blocks.length && (
        <div className="panel empty-small">
          No study blocks yet. Review dated assessments, set remaining effort
          above zero, and check your available hours.
        </div>
      )}
    </>
  );
}
