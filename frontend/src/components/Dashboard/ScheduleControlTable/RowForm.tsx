// src/components/Dashboard/ScheduleControlTable/RowForm.tsx

import { Table, Input, Checkbox, Field } from "@chakra-ui/react";
import type { ScheduleRow } from "@/client";
import type { ScheduleDisplayRow } from "./types";
import TimePicker from "@/components/ui/TimePicker";

interface RowFormProps {
  row: ScheduleDisplayRow;
  invalidRows: number[];
  handleChange: (id: number, field: keyof ScheduleRow, value: any) => void;
}

const RowForm = ({ row, invalidRows, handleChange }: RowFormProps) => {
  const isInvalid = invalidRows.includes(row.id);
  // --- FIX: Refine Start Time Invalid Condition ---
  // Mark invalid IF the row ID is in the invalid list,
  // UNLESS it's the very first record (rec_no 1) AND its start time is 00:00:00
  const isStartTimeInvalid = isInvalid && !(row.rec_no === 1 && row.start_time === "00:00:00");
  // --- END FIX ---

  return (
    <Table.Row
      key={row.id}
      // --- FIX: Use isStartTimeInvalid for row background ---
      // Only make the row background red if the START TIME is truly invalid
      bg={isStartTimeInvalid ? "red.50" : "white"}
      // --- END FIX ---
      _hover={{ bg: "gray.50" }}>
      <Table.Cell>{row.rec_no}</Table.Cell>
      <Table.Cell>
        <Field.Root
          // --- Pass invalid prop here ---
          invalid={isStartTimeInvalid}
          // Optionally add a unique ID if needed for accessibility later
          // id={`start-time-${row.id}`}
        >
          <Input
            type="time"
            size="sm"
            value={row.start_time.slice(0, 5)}
            onChange={(e) =>
              handleChange(
                row.id,
                "start_time",
                `${e.target.value || "00:00"}:00`,
              )
            }
            readOnly={
              row.rec_no === 1 && row.start_time === "00:00:00"
            }
            bg={
              isStartTimeInvalid ? "red.100" :
              (row.rec_no === 1 && row.start_time === "00:00:00"
                ? "gray.100"
                : "white")
            }
          />
          {/* <TimePicker
            size="sm"
            value={row.start_time.slice(0, 5)} // Only pass HH:mm part
            onChange={(time) => handleChange(row.id, "start_time", time)}
            readOnly={row.rec_no === 1 && row.start_time === "00:00:00"}
            bg={row.rec_no === 1 && row.start_time === "00:00:0" ? "gray.100" : "white"}
          /> */}
        </Field.Root>
      </Table.Cell>
      <Table.Cell>
        <Input type="time" size="sm" value={row.displayEndTime.slice(0, 5)} readOnly bg="gray.100" />
      </Table.Cell>
      <Table.Cell textAlign="end">
        <Checkbox.Root variant="outline" checked={row.charge_from_grid} onCheckedChange={(e) => handleChange(row.id, "charge_from_grid", e.checked)}>
          <Checkbox.HiddenInput />
          <Checkbox.Control />
        </Checkbox.Root>
      </Table.Cell>
      <Table.Cell textAlign="end">
        <Checkbox.Root variant="outline" checked={row.allow_to_sell} onCheckedChange={(e) => handleChange(row.id, "allow_to_sell", e.checked)}>
          <Checkbox.HiddenInput />
          <Checkbox.Control />
        </Checkbox.Root>
      </Table.Cell>
      <Table.Cell textAlign="end">
        <Input type="number" size="sm" w="80px" value={row.charge_power} onChange={(e) => handleChange(row.id, "charge_power", Number(e.target.value))} />
      </Table.Cell>
      <Table.Cell textAlign="end">
        <Input type="number" size="sm" w="80px" value={row.charge_limit} onChange={(e) => handleChange(row.id, "charge_limit", Number(e.target.value))} />
      </Table.Cell>
      <Table.Cell textAlign="end">
        <Input type="number" size="sm" w="80px" value={row.discharge_power} onChange={(e) => handleChange(row.id, "discharge_power", Number(e.target.value))} />
      </Table.Cell>
    </Table.Row>
  );
};

export default RowForm;
