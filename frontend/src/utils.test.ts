import { describe, expect, it } from "vitest";
import {
  addDays,
  dateLabel,
  moduleColor,
  monthCells,
  shiftMonth,
} from "./utils";

describe("date-only utilities", () => {
  it("keeps leap days and year boundaries", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });
  it("aligns month cells to Monday without phantom days", () => {
    const cells = monthCells("2026-11");
    expect(cells.slice(0, 6)).toEqual(Array(6).fill(null));
    expect(cells[6]).toBe("2026-11-01");
    expect(cells.at(-1)).toBe("2026-11-30");
  });
  it("does not invent an unknown deadline", () => {
    expect(dateLabel(null)).toBe("Date to confirm");
  });
  it("assigns stable module colours", () => {
    expect(moduleColor("CS401")).toBe(moduleColor("CS401"));
  });
});
