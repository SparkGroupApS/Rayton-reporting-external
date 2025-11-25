// src/components/Dashboard/ScheduleControlTable/types.ts

import type { ScheduleRow } from "@/client";

// Interface for the data we actually render
export interface ScheduleDisplayRow extends ScheduleRow {
  displayEndTime: string;
}

export interface ScheduleControlTableProps {
  tenantId: string; // <-- ADD tenantId (UUID string)
  date: string;
  onScheduleDataChange?: (data: ScheduleRow[]) => void; // Callback to notify when schedule data changes
}

export type NewScheduleRow = Omit<
  ScheduleRow,
  "id" | "updated_at" | "rec_no" | "updated_by"
>;
