// src/components/Dashboard/ScheduleControlTable/AddRowForm.tsx

import { Table, Input, Checkbox, Field, IconButton } from "@chakra-ui/react";
import { LuPlus } from "react-icons/lu";
import type { NewScheduleRow } from "./types";

interface AddRowFormProps {
  newRow: NewScheduleRow;
  isNewRowStartTimeInvalid: boolean;
  nextRecNoDisplay: number;
  handleNewRowChange: (field: keyof NewScheduleRow, value: any) => void;
  handleAddRow: () => void;
}

const AddRowForm = ({ newRow, isNewRowStartTimeInvalid, nextRecNoDisplay, handleNewRowChange, handleAddRow }: AddRowFormProps) => {
  return (
    <Table.Row key="new-row" bg="gray.50">
      {/* Display calculated next rec_no */}
      <Table.Cell>{nextRecNoDisplay}</Table.Cell>
      {/* ... Rest of the 'Add New' row inputs ... */}
      <Table.Cell>
        <Field.Root
          invalid={isNewRowStartTimeInvalid} // Use new state here
        >
          <Input
            type="time"
            size="sm"
            value={newRow.start_time.slice(0, 5)}
            onChange={(e) => handleNewRowChange("start_time", `${e.target.value || "00:00"}:00`)}
          />
        </Field.Root>
      </Table.Cell>
      <Table.Cell>
        {/* End time is implicit */}
        <Input type="time" size="sm" readOnly placeholder="--" bg="gray.100" />
      </Table.Cell>
      <Table.Cell textAlign="end">
        <Checkbox.Root variant="outline" checked={newRow.charge_enable} onCheckedChange={(e) => handleNewRowChange("charge_enable", e.checked)}>
          <Checkbox.HiddenInput />
          <Checkbox.Control />
        </Checkbox.Root>
      </Table.Cell>
      <Table.Cell textAlign="end">
        <Checkbox.Root variant="outline" checked={newRow.charge_from_grid} onCheckedChange={(e) => handleNewRowChange("charge_from_grid", e.checked)}>
          <Checkbox.HiddenInput />
          <Checkbox.Control />
        </Checkbox.Root>
      </Table.Cell>
      <Table.Cell textAlign="end">
        <Checkbox.Root variant="outline" checked={newRow.discharge_enable} onCheckedChange={(e) => handleNewRowChange("discharge_enable", e.checked)}>
          <Checkbox.HiddenInput />
          <Checkbox.Control />
        </Checkbox.Root>
      </Table.Cell>
      <Table.Cell textAlign="end">
        <Checkbox.Root variant="outline" checked={newRow.allow_to_sell} onCheckedChange={(e) => handleNewRowChange("allow_to_sell", e.checked)}>
          <Checkbox.HiddenInput />
          <Checkbox.Control />
        </Checkbox.Root>
      </Table.Cell>
      <Table.Cell textAlign="end">
        <Input type="number" size="sm" w="100px" value={newRow.charge_power} onChange={(e) => handleNewRowChange("charge_power", Number(e.target.value))} />
      </Table.Cell>
      <Table.Cell textAlign="end">
        <Input type="number" size="sm" w="100px" value={newRow.charge_limit} onChange={(e) => handleNewRowChange("charge_limit", Number(e.target.value))} />
      </Table.Cell>
      <Table.Cell textAlign="end">
        <Input
          type="number"
          size="sm"
          w="100px"
          value={newRow.discharge_power}
          onChange={(e) => handleNewRowChange("discharge_power", Number(e.target.value))}
        />
      </Table.Cell>
      <Table.Cell>
        <IconButton aria-label="Add Row" size="sm" colorScheme="green" onClick={handleAddRow}>
          <LuPlus />
        </IconButton>
      </Table.Cell>
    </Table.Row>
  );
};

export default AddRowForm;
