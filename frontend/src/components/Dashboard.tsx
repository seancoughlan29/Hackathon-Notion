import { useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import type { Assessment, PlanResponse, Project, Tab } from "../types";
import {
  addDays,
  dateLabel,
  moduleColor,
  monthCells,
  shiftMonth,
} from "../utils";

export function Dashboard({
  project,
  result,
  navigate,
  edit,
}: {
  project: Project;
  result: PlanResponse;
  navigate: (tab: Tab) => void;
  edit: (item: Assessment) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [month, setMonth] = useState(project.settings.plan_from.slice(0, 7));
  const [showStudy, setShowStudy] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const reviewed = project.assessments.filter((item) => item.reviewed);
  const crunch = result.weeks.filter((week) => week.Pressure === "Crunch");
  const remaining = project.assessments.length - reviewed.length;
  const shortfall =
    result.plan.shortfalls.reduce((sum, row) => sum + row.minutes, 0) / 60;
  const peak = [...result.weeks].sort((a, b) => b.Deadlines - a.Deadlines)[0];
  const max = Math.max(4, ...result.weeks.map((week) => week.Deadlines));
  const selectedWeek =
    selected === null
      ? null
      : result.weeks.find((week) => week.Week === selected);
  const upcoming = [...reviewed]
    .filter(
      (item) =>
        item.due_date &&
        item.due_date >= project.settings.plan_from &&
        (!selectedWeek ||
          (item.due_date >= selectedWeek.Starting &&
            item.due_date < addDays(selectedWeek.Starting, 7))),
    )
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))
    .slice(0, 5);
  const monthTitle = new Intl.DateTimeFormat("en-IE", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T12:00:00Z`));
  const dailyItems = selectedDate
    ? reviewed.filter((item) => item.due_date === selectedDate)
    : [];
  const dailyBlocks = selectedDate
    ? result.plan.blocks.filter(
        (block) => block.start.slice(0, 10) === selectedDate,
      )
    : [];
  return (
    <>
      <div className="stats">
        <div className="stat">
          <span>
            <CalendarDays size={17} /> Assessments
          </span>
          <strong>
            {project.assessments.length}
            <small>
              across{" "}
              {new Set(project.assessments.map((item) => item.module)).size}{" "}
              modules
            </small>
          </strong>
        </div>
        <div className="stat">
          <span>
            <TriangleAlert size={17} /> Crunch weeks
          </span>
          <strong>
            {crunch.length}
            <small>3+ deadlines in one week</small>
          </strong>
        </div>
        <div className="stat">
          <span>
            <Clock3 size={17} /> Study scheduled
          </span>
          <strong>
            {result.plan.blocks.reduce((sum, block) => sum + block.minutes, 0) /
              60}
            <em>h</em>
            <small>{result.plan.blocks.length} manageable blocks</small>
          </strong>
        </div>
        <div className={`stat ${shortfall > 0 ? "stat-warning" : ""}`}>
          <span>
            <Sparkles size={17} />{" "}
            {remaining ? "Ready for review" : "Unscheduled work"}
          </span>
          <strong>
            {remaining || shortfall}
            {!remaining && <em>h</em>}
            <small>
              {remaining
                ? "check the source before planning"
                : shortfall
                  ? "adjust your available hours"
                  : "all estimated work has a place"}
            </small>
          </strong>
        </div>
      </div>
      {remaining > 0 && (
        <button
          className="notice notice-button"
          onClick={() => navigate("assessments")}
        >
          {remaining} assessment{remaining === 1 ? "" : "s"} need review before
          they appear in your plan. <ArrowRight size={16} />
        </button>
      )}
      <div className="overview-grid">
        <section className="panel workload">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">THE BIG PICTURE</span>
              <h2>Your semester, at a glance.</h2>
            </div>
            <span className="badge neutral">{result.weeks.length} weeks</span>
          </div>
          <div
            className="chart"
            role="group"
            aria-label="Weekly deadline counts"
          >
            {result.weeks.map((week) => (
              <button
                key={week.Week}
                className={`chart-column ${selected === week.Week ? "active" : ""}`}
                onClick={() =>
                  setSelected(selected === week.Week ? null : week.Week)
                }
                aria-label={`Week ${week.Week}: ${week.Deadlines} deadlines`}
                aria-pressed={selected === week.Week}
                title={`${dateLabel(week.Starting)} · ${week.Deadlines} deadlines · ${week["Effort (h)"]}h estimated work`}
              >
                <span className="bar-area">
                  <span
                    className={`bar ${week.Pressure.toLowerCase()}`}
                    style={{
                      height: `${Math.max(5, (week.Deadlines / max) * 100)}%`,
                    }}
                  >
                    {week.Deadlines > 0 && <b>{week.Deadlines}</b>}
                  </span>
                </span>
                <span className="week-number">W{week.Week}</span>
              </button>
            ))}
          </div>
          <div className="chart-footer">
            <span>Deadlines per teaching week · click to explore</span>
            <span>
              <i className="dot green" /> Steady <i className="dot coral" />{" "}
              Crunch
            </span>
          </div>
          <p className="small muted">
            Week 1 starts {dateLabel(project.settings.semester_start)}. Break
            weeks are included; confirm your university's teaching-week dates.
          </p>
        </section>
        <aside className="crunch-card">
          <span className="eyebrow">A LITTLE FORESIGHT GOES A LONG WAY</span>
          <div className="crunch-illustration" aria-hidden="true">
            <div className="mini-sheet back" />
            <div className="mini-sheet">
              <CalendarDays size={22} />
              <b>{peak?.Week ?? "—"}</b>
              <small>WEEK</small>
            </div>
            <span className="spark">✳</span>
          </div>
          <h2>
            {peak?.Deadlines
              ? `Week ${peak.Week} needs a head start.`
              : "A calmer semester starts here."}
          </h2>
          <p>
            {peak?.Deadlines
              ? `${peak.Deadlines} deadlines land from ${dateLabel(peak.Starting)}. Your plan works backwards to make space before the rush.`
              : "Review your assessments to see where the busy weeks land."}
          </p>
          {peak &&
            Object.entries(peak["Module weights"]).map(([module, weight]) => (
              <span className="weight-pill" key={module}>
                {module.split(" · ")[0]} · {weight}%
              </span>
            ))}
          <button className="text-link" onClick={() => navigate("study")}>
            See your study plan <ArrowRight size={17} />
          </button>
        </aside>
      </div>
      <div className="lower-grid">
        <section className="panel calendar-panel">
          <div className="panel-heading">
            <h2>{monthTitle}</h2>
            <div className="calendar-controls">
              <button
                className="icon-button"
                aria-label="Previous month"
                onClick={() => {
                  setMonth(shiftMonth(month, -1));
                  setSelectedDate(null);
                }}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                className="icon-button"
                aria-label="Next month"
                onClick={() => {
                  setMonth(shiftMonth(month, 1));
                  setSelectedDate(null);
                }}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
          <label className="check-row small">
            <input
              type="checkbox"
              checked={showStudy}
              onChange={(e) => setShowStudy(e.target.checked)}
            />
            Include study blocks
          </label>
          <div className="calendar-grid">
            {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => (
              <div className="calendar-weekday" key={i}>
                {day}
              </div>
            ))}
            {monthCells(month).map((day, i) => {
              const items = reviewed.filter(
                (item) => day && item.due_date === day,
              );
              const blocks = showStudy
                ? result.plan.blocks.filter(
                    (block) => day && block.start.slice(0, 10) === day,
                  )
                : [];
              return day ? (
                <button
                  key={day}
                  className={`calendar-day ${selectedDate === day ? "chosen" : ""} ${items.length >= 2 ? "crowded" : ""}`}
                  onClick={() => setSelectedDate(day)}
                  aria-label={`${dateLabel(day)}: ${items.length} deadlines, ${blocks.length} study blocks`}
                >
                  <span>{Number(day.slice(-2))}</span>
                  <div className="calendar-dots">
                    {items.slice(0, 3).map((item) => (
                      <i
                        className="dot"
                        key={item.id}
                        style={{ background: moduleColor(item.module) }}
                      />
                    ))}
                    {blocks.length > 0 && <i className="dot study-dot" />}
                  </div>
                </button>
              ) : (
                <div key={`blank-${i}`} />
              );
            })}
          </div>
          {selectedDate && (
            <div className="day-detail">
              <strong>{dateLabel(selectedDate, true)}</strong>
              {dailyItems.map((item) => (
                <button
                  className="day-item"
                  key={item.id}
                  onClick={() => edit(item)}
                >
                  {item.due_time?.slice(0, 5) || "All day"} · {item.title}
                </button>
              ))}
              {showStudy &&
                dailyBlocks.map((block) => (
                  <div className="small" key={block.id}>
                    {block.start.slice(11, 16)} · Study: {block.title}
                  </div>
                ))}
              {!dailyItems.length && (!showStudy || !dailyBlocks.length) && (
                <p className="muted small">Nothing scheduled.</p>
              )}
            </div>
          )}
        </section>
        <section className="panel next-up">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">ONE THING AT A TIME</span>
              <h2>
                {selectedWeek
                  ? `Week ${selectedWeek.Week} deadlines`
                  : "Coming up next"}
              </h2>
            </div>
            <button
              className="text-link"
              onClick={() => navigate("assessments")}
            >
              View all <ArrowRight size={16} />
            </button>
          </div>
          {upcoming.length ? (
            upcoming.map((item) => (
              <button
                className="deadline-row"
                key={item.id}
                onClick={() => edit(item)}
              >
                <span className="date-tile">
                  <b>{Number(item.due_date?.slice(-2))}</b>
                  <small>
                    {dateLabel(item.due_date).split(" ").slice(1).join(" ")}
                  </small>
                </span>
                <span className="deadline-info">
                  <strong>{item.title}</strong>
                  <small>
                    <i
                      className="dot"
                      style={{ background: moduleColor(item.module) }}
                    />
                    {item.module}
                  </small>
                </span>
                <span className="badge neutral">
                  {item.weight_percent === null
                    ? "—"
                    : `${item.weight_percent}%`}
                </span>
              </button>
            ))
          ) : (
            <div className="empty-small">
              No reviewed deadlines in this window.
            </div>
          )}
          <div className="tip">
            <Sparkles size={19} />
            <p>
              Percentages belong to each module. Your plan uses estimated hours
              to balance the work.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
