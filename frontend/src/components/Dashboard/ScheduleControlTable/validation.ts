// src/components/Dashboard/ScheduleControlTable/validation.ts

import type { ScheduleRow } from "@/client";
import type { NewScheduleRow } from "./types";

// --- Helper: Convert time string to minutes ---
// Returns -1 for invalid/null time
export const timeToMinutes = (t: string | null | undefined): number => {
  if (!t) return -1;
  try {
    const [h, m] = t.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return -1;
    return h * 60 + m;
  } catch (_e) {
    return -1;
  }
};

// --- Helper: Sort localData by start_time ---
export const sortScheduleRows = (rows: ScheduleRow[]): ScheduleRow[] => {
  return [...rows].sort(
    (a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time),
  );
};

// --- Validation: Check for duplicate start_time ---
export const validateRows = (
  rows: ScheduleRow[],
  timeToMinutesFn: (t: string | null | undefined) => number = timeToMinutes,
): boolean => {
  const invalidIds: number[] = [];
  const startTimeCounts = new Map<string, number[]>(); // Map: startTime -> array of row IDs

  // --- FIX: Only validate "active" rows ---
  const rowsToValidate = rows.filter(
    (row) => row.rec_no === 1 || row.start_time !== "00:00:00",
  );

  // First pass: Collect all IDs for each start time
  for (const row of rowsToValidate) { // <-- Use the new filtered list
    const time = row.start_time;
    const rowId = row.id; // Get the ID

    if (timeToMinutesFn(time) === -1) {
      // Check for invalid time format first
      invalidIds.push(rowId);
    } else {
      if (!startTimeCounts.has(time)) {
        startTimeCounts.set(time, []);
      }
      startTimeCounts.get(time)!.push(rowId);
    }
  }
  
  // Second pass: Identify duplicates and add to invalid list, excluding the first "00:00:00"
  for (const [time, ids] of startTimeCounts.entries()) {
    if (ids.length > 1) {
      // Found a duplicate start time
      // --- FIX: Exclude the first record if the duplicate is "00:00:00" ---
      if (time === "00:00") {
        // Find the ID of the actual first record (rec_no 1)
        const firstRecordId = rowsToValidate.find((r) => r.rec_no === 1)?.id;
        // Add all IDs *except* the first record's ID
        ids.forEach((id) => {
          if (id !== firstRecordId) {
            invalidIds.push(id);
          }
        });
      } else {
        // If the duplicate time is not "00:00:00", add all associated IDs
        invalidIds.push(...ids);
      }
      // --- END FIX ---
    }
  }

  return invalidIds.length === 0; // Return true if valid
};

// --- Default values for a new row ---
// We'll calculate rec_no when adding
export const createNewScheduleRowTemplate = (): NewScheduleRow => ({
  start_time: "00:00:00",
  charge_from_grid: false,
  allow_to_sell: false,
  charge_power: 0,
  charge_limit: 100,
  discharge_power: 0,
  source: 0,
});
