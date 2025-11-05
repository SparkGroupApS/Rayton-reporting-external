// src/components/Dashboard/ScheduleControlTable.tsx

import {
  Box,
  Button,
  Checkbox,
  Field, // Use VStack for Save All button layout
  Flex,
  IconButton,
  Input,
  Spinner,
  Table, // This is now the main namespace
  Text,
  VStack,
} from "@chakra-ui/react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { LuPlus } from "react-icons/lu"
import type { ApiError, ScheduleRow } from "@/client"
import { toaster } from "@/components/ui/toaster"
import {
  useBulkUpdateSchedule,
  useGetSchedule,
} from "@/hooks/useScheduleQueries"

interface ScheduleControlTableProps {
  // plantId: number; // REMOVE
 // tenantDb: string; // REMOVE
  tenantId: string // <-- ADD tenantId (UUID string)
  date: string
 onScheduleDataChange?: (data: ScheduleRow[]) => void // Callback to notify when schedule data changes
}

// Interface for the data we actually render
interface ScheduleDisplayRow extends ScheduleRow {
  displayEndTime: string
}

// --- Default values for a new row ---
// We'll calculate rec_no when adding
const createNewScheduleRowTemplate = (): Omit<
  ScheduleRow,
  "id" | "updated_at" | "rec_no" | "updated_by"
> => ({
  start_time: "00:00:00",
  charge_enable: false,
  charge_from_grid: false,
  discharge_enable: false,
  allow_to_sell: false,
  charge_power: 0,
  charge_limit: 100,
  discharge_power: 0,
  source: 0,
})

const ScheduleControlTable = ({
  tenantId,
  date,
  onScheduleDataChange,
}: ScheduleControlTableProps) => {
  // <-- Use tenantId
  const {
    data: serverData,
    isLoading: loadingSchedule,
    error,
    // --- CHANGE: Pass tenantId to hooks ---
  } = useGetSchedule({ tenantId, date })

  const { mutate: bulkUpdateSchedule, isPending: isSaving } =
    useBulkUpdateSchedule({ tenantId, date })

  // --- LOCAL STATE (Source of Truth) ---
  // This matches the API/DB structure (end_time is null)
  const [localData, setLocalData] = useState<ScheduleRow[]>([])
  // --- END ---

  const [invalidRows, setInvalidRows] = useState<number[]>([])
  const [newRow, setNewRow] = useState(createNewScheduleRowTemplate())
  const [isNewRowStartTimeInvalid, setIsNewRowStartTimeInvalid] =
    useState(false)
// --- Helper: Convert time string to minutes ---
  // Returns -1 for invalid/null time
  const timeToMinutes = useCallback((t: string | null | undefined): number => {
    if (!t) return -1
    try {
      const [h, m] = t.split(":").map(Number)
      if (Number.isNaN(h) || Number.isNaN(m)) return -1
      return h * 60 + m
    } catch (_e) {
      return -1
    }
  }, []) // <-- Add useCallback with an empty dependency array

  // --- Helper: Sort localData by start_time ---
  const sortScheduleRows = useCallback(
    (rows: ScheduleRow[]) => {
      return [...rows].sort(
        (a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time),
      )
    },
    [timeToMinutes],
  )

   // --- Validation: Check for duplicate start_time ---
  const validateRows = useCallback(
    (rows: ScheduleRow[]): boolean => {
      const invalidIds: number[] = []
      const startTimeCounts = new Map<string, number[]>() // Map: startTime -> array of row IDs

      // --- FIX: Only validate "active" rows ---
      const rowsToValidate = rows.filter(
        (row) => row.rec_no === 1 || row.start_time !== "00:00:00",
      )

      // First pass: Collect all IDs for each start time
      for (const row of rowsToValidate) { // <-- Use the new filtered list
        const time = row.start_time
        const rowId = row.id // Get the ID

        if (timeToMinutes(time) === -1) {
          // Check for invalid time format first
          invalidIds.push(rowId)
        } else {
          if (!startTimeCounts.has(time)) {
            startTimeCounts.set(time, [])
          }
          startTimeCounts.get(time)!.push(rowId)
        }
      }
      // Second pass: Identify duplicates and add to invalid list, excluding the first "00:00:00"
      for (const [time, ids] of startTimeCounts.entries()) {
        if (ids.length > 1) {
          // Found a duplicate start time
          // --- FIX: Exclude the first record if the duplicate is "00:00:00" ---
          if (time === "00:00:00") {
            // Find the ID of the actual first record (rec_no 1)
            const firstRecordId = rowsToValidate.find((r) => r.rec_no === 1)?.id
            // Add all IDs *except* the first record's ID
            ids.forEach((id) => {
              if (id !== firstRecordId) {
                invalidIds.push(id)
              }
            })
          } else {
            // If the duplicate time is not "00:00:00", add all associated IDs
            invalidIds.push(...ids)
          }
          // --- END FIX ---
        }
      }

      const uniqueInvalidIds = [...new Set(invalidIds)]
      setInvalidRows(uniqueInvalidIds)
      return uniqueInvalidIds.length === 0 // Return true if valid
    },
    [timeToMinutes],
  ) // Removed dependency on timeToMinutes
  
   // --- Sync server data to local state when it loads ---
  // --- Sync server data to local state ---
  useEffect(() => {
    if (serverData) {
      const cleanedData = serverData.map((row) => ({
        ...row,
        end_time: null, // We only care about start_time from the DB
      }))
      setLocalData(cleanedData)
      validateRows(cleanedData) // Validate on load
    } else {
      setLocalData([])
      setInvalidRows([])
    }
    setNewRow(createNewScheduleRowTemplate())
  }, [serverData, validateRows])

  // Notify parent component when local data changes
  useEffect(() => {
    if (onScheduleDataChange) {
      onScheduleDataChange(localData);
    }
 }, [localData, onScheduleDataChange]);

 

  // --- CREATE DISPLAY DATA (User-Friendly View) ---
  const displayData = useMemo((): ScheduleDisplayRow[] => {
    if (localData.length === 0) return []

    const sorted = sortScheduleRows(localData)
    const potentialNextStartTime = newRow.start_time
    const potentialNextStartMinutes = timeToMinutes(potentialNextStartTime)

    return sorted.map((row, index) => {
      let nextDistinctStartTime: string
      const currentRowStartTime = row.start_time

      // --- FIX: Check if we are on the last chronological row ---
      if (index === sorted.length - 1) {
        // If it's the last row, the "next" start could be the new row template
        // OR wrap around to the first row (00:00:00 usually)
        const firstRowStartTime = sorted[0]?.start_time ?? "00:00:00"

        // Use the newRow start time IF it's valid AND comes after the last row's start time
        if (
          potentialNextStartMinutes !== -1 &&
          potentialNextStartMinutes > timeToMinutes(currentRowStartTime)
        ) {
          nextDistinctStartTime = potentialNextStartTime
        } else {
          // Otherwise, wrap around to the first row's start time
          nextDistinctStartTime = firstRowStartTime
        }
      } else {
        // --- Original Logic: Find the next distinct start time in the existing data ---
        nextDistinctStartTime = "00:00:00" // Default wrap-around
        for (let j = 1; j < sorted.length; j++) {
          const nextCheckIndex = (index + j) % sorted.length
          if (sorted[nextCheckIndex].start_time !== currentRowStartTime) {
            nextDistinctStartTime = sorted[nextCheckIndex].start_time
            break
          }
        }
      }
      // --- END FIX ---
      return {
        ...row,
        displayEndTime: nextDistinctStartTime, // Use the found distinct time
      }
    })
  }, [localData, sortScheduleRows, newRow.start_time, timeToMinutes])
  // --- END ---

  // Calculate the next rec_no for the 'Add New' row display
  const nextRecNoDisplay = useMemo(() => {
    const usedRows = localData.filter(
      (row) => row.rec_no === 1 || row.start_time !== "00:00:00",
    )
    const lastUsedRecNo =
      usedRows.length > 0 ? Math.max(...usedRows.map((r) => r.rec_no)) : 0
    return lastUsedRecNo + 1
  }, [localData])

  // --- Handle changes in existing rows ---
  const handleChange = (id: number, field: keyof ScheduleRow, value: any) => {
    setLocalData((prev) => {
      const updated = prev.map((row) =>
        row.id === id ? { ...row, [field]: value } : row,
      )
      validateRows(updated) // Re-validate
      return updated // This triggers the useMemo to update displayData
    })
  }

  // --- Handle changes in the 'new row' template ---
  const handleNewRowChange = (
    field: keyof Omit<ScheduleRow, "id" | "updated_at" | "rec_no">,
    value: any,
  ) => {
    // Update the newRow state first
    setNewRow((prev) => ({ ...prev, [field]: value }))

    // --- ADD Immediate Validation for start_time ---
    if (field === "start_time") {
      const newStartTime = value as string // Assuming value is the time string "HH:MM:SS"
      const isValidFormat = timeToMinutes(newStartTime) !== -1
      const isDuplicate = localData.some(
        (row) => row.start_time === newStartTime,
      )

      // Set invalid if format is bad OR it's a duplicate
      setIsNewRowStartTimeInvalid(!isValidFormat || isDuplicate)
    }
  }

  // --- Add the new row to localData ---
  const handleAddRow = () => {
    // Validation now uses the state variable set by handleNewRowChange
    if (isNewRowStartTimeInvalid) {
      const isValidFormat = timeToMinutes(newRow.start_time) !== -1
      if (!isValidFormat) {
        toaster.create({
          title: "Invalid Start Time",
          description: "Please enter a valid start time.",
          type: "error",
        })
      } else {
        toaster.create({
          title: "Duplicate Start Time",
          description: "A schedule entry already exists for this start time.",
          type: "warning",
        })
      }
      return
    }

    // --- FIX: Calculate next rec_no based on *used* rows ---
    // 1. Filter localData to find rows that are considered 'used'
    //    (rec_no 1 OR start_time is not 00:00:00)
    const usedRows = localData.filter(
      (row) => row.rec_no === 1 || row.start_time !== "00:00:00",
    )

    // 2. Find the highest rec_no among the used rows
    const lastUsedRecNo =
      usedRows.length > 0 ? Math.max(...usedRows.map((r) => r.rec_no)) : 0 // If no rows are used (only possible if serverData is empty), start at 0

    // 3. The new row's rec_no is the next sequential number
    const nextRecNo = lastUsedRecNo + 1

    // Optional: Check if nextRecNo exceeds 24
    if (nextRecNo > 24) {
      toaster.create({
        title: "Limit Reached",
        description: "Cannot add more than 24 schedule entries.",
        type: "warning",
      })
      return
    }

    const tempRow: ScheduleRow = {
      ...newRow,
      // --- FIX: Assign calculated rec_no ---
      rec_no: nextRecNo,
      // --- END FIX ---
      id: -Date.now(), // Temporary unique negative ID
      updated_at: new Date().toISOString(),
      updated_by: '',
    }

    setLocalData((prev) => {
      const newData = [...prev, tempRow]
      validateRows(newData) // Validate includes the new row
      return newData // Don't sort here, sort happens in displayData and save
    })
    setNewRow(createNewScheduleRowTemplate()) // Reset template
    setIsNewRowStartTimeInvalid(false) // Reset new row validity
  }

  // --- Save All Changes ---
  const handleSaveAll = () => {
    if (!validateRows(localData)) {
      toaster.create({
        title: "Invalid Data",
        description: "Please fix duplicate start times (highlighted in red).",
        type: "error",
      })
      return
    }

    // Recalculate rec_no and create the final payload
    const sortedData = sortScheduleRows(localData)
    // Filter out unused rows (start_time 00:00:00 and not rec_no 1) before saving
    const dataToSave = sortedData
      .filter((row) => row.rec_no === 1 || row.start_time !== "00:00:00")
      .map((row, index) => ({
        ...row,
        rec_no: index + 1, // Assign final sequential rec_no based on *saved* rows
        end_time: null,
      }))

    // Fill remaining slots up to 24 with default values if needed
    const defaultRowValues = createNewScheduleRowTemplate()
    while (dataToSave.length < 24) {
      dataToSave.push({
        ...defaultRowValues,
        id: -(Date.now() + dataToSave.length), // Temp negative ID
        rec_no: dataToSave.length + 1,
        updated_at: new Date().toISOString(),
        end_time: null,
        updated_by: '',
      })
    }

    bulkUpdateSchedule(dataToSave, {
      onSuccess: (_savedData) => {
        // savedData is the new list from the DB
        toaster.create({
          title: "Schedule Saved",
          description: "All changes saved successfully.",
          type: "success",
        })
        // The useGetSchedule hook will be invalidated and refetch
        // serverData, which triggers the useEffect to update localData.
      },
      onError: (err: ApiError) => {
        toaster.create({
          title: "Save Failed",
          description: err.message || "Could not save schedule.",
          type: "error",
        })
      },
    })
  }

  if (loadingSchedule) {
    return (
      <Flex justify="center" align="center" h="200px">
        <Spinner />
      </Flex>
    )
  }
  if (error) {
    return <Text color="red.500">Error loading schedule: {error.message}</Text>
  }

  // Filter the final displayData
  const filteredDisplayData = displayData.filter(
    (row) => row.rec_no === 1 || row.start_time !== "00:00:00",
  )

  return (
    <VStack gap={0} align="stretch">
      {" "}
      {/* Wrap table and button */}
      <Box overflowX="auto">
        <Table.Root size="sm">
          {/* variant="simple"  */}
          <Table.Header bg="gray.100">
            <Table.Row>
              <Table.ColumnHeader>Rec</Table.ColumnHeader>
              <Table.ColumnHeader>Start</Table.ColumnHeader>
              <Table.ColumnHeader>End</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="end">Charge</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="end">From Grid</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="end">Discharge</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="end">Sell</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="end">
                Charge Power
              </Table.ColumnHeader>
              <Table.ColumnHeader textAlign="end">
                Charge Limit
              </Table.ColumnHeader>
              <Table.ColumnHeader textAlign="end">
                Discharge Power
              </Table.ColumnHeader>
              {/*<Table.ColumnHeader>Save</Table.ColumnHeader> */}
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {/* --- Render Filtered Rows --- */}
            {filteredDisplayData.map((row) => {
              const isInvalid = invalidRows.includes(row.id)
              // --- FIX: Refine Start Time Invalid Condition ---
              // Mark invalid IF the row ID is in the invalid list,
              // UNLESS it's the very first record (rec_no 1) AND its start time is 00:00:00
              const isStartTimeInvalid =
                isInvalid &&
                !(row.rec_no === 1 && row.start_time === "00:00:00")
              // --- END FIX ---
              return (
                <Table.Row
                  key={row.id}
                  // --- FIX: Use isStartTimeInvalid for row background ---
                  // Only make the row background red if the START TIME is truly invalid
                  bg={isStartTimeInvalid ? "red.50" : "white"}
                  // --- END FIX ---
                  _hover={{ bg: "gray.50" }}
                >
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
                          row.rec_no === 1 && row.start_time === "00:00:00"
                            ? "gray.100"
                            : "white"
                        }
                      />
                    </Field.Root>
                  </Table.Cell>
                  <Table.Cell>
                    <Input
                      type="time"
                      size="sm"
                      value={row.displayEndTime.slice(0, 5)}
                      readOnly
                      bg="gray.100"
                    />
                  </Table.Cell>
                  {/* ... Checkboxes and Numeric Inputs (use handleChange) ... */}
                  <Table.Cell textAlign="end">
                    <Checkbox.Root
                      variant="outline"
                      checked={row.charge_enable}
                      onCheckedChange={(e) =>
                        handleChange(row.id, "charge_enable", e.checked)
                      }
                    >
                      <Checkbox.HiddenInput />
                      <Checkbox.Control />
                    </Checkbox.Root>
                  </Table.Cell>
                  <Table.Cell textAlign="end">
                    <Checkbox.Root
                      variant="outline"
                      checked={row.charge_from_grid}
                      onCheckedChange={(e) =>
                        handleChange(row.id, "charge_from_grid", e.checked)
                      }
                    >
                      <Checkbox.HiddenInput />
                      <Checkbox.Control />
                    </Checkbox.Root>
                  </Table.Cell>
                  <Table.Cell textAlign="end">
                    <Checkbox.Root
                      variant="outline"
                      checked={row.discharge_enable}
                      onCheckedChange={(e) =>
                        handleChange(row.id, "discharge_enable", e.checked)
                      }
                    >
                      <Checkbox.HiddenInput />
                      <Checkbox.Control />
                    </Checkbox.Root>
                  </Table.Cell>
                  <Table.Cell textAlign="end">
                    <Checkbox.Root
                      variant="outline"
                      checked={row.allow_to_sell}
                      onCheckedChange={(e) =>
                        handleChange(row.id, "allow_to_sell", e.checked)
                      }
                    >
                      <Checkbox.HiddenInput />
                      <Checkbox.Control />
                    </Checkbox.Root>
                  </Table.Cell>
                  <Table.Cell textAlign="end">
                    <Input
                      type="number"
                      size="sm"
                      w="100px"
                      value={row.charge_power}
                      onChange={(e) =>
                        handleChange(
                          row.id,
                          "charge_power",
                          Number(e.target.value),
                        )
                      }
                    />
                  </Table.Cell>
                  <Table.Cell textAlign="end">
                    <Input
                      type="number"
                      size="sm"
                      w="100px"
                      value={row.charge_limit}
                      onChange={(e) =>
                        handleChange(
                          row.id,
                          "charge_limit",
                          Number(e.target.value),
                        )
                      }
                    />
                  </Table.Cell>
                  <Table.Cell textAlign="end">
                    <Input
                      type="number"
                      size="sm"
                      w="100px"
                      value={row.discharge_power}
                      onChange={(e) =>
                        handleChange(
                          row.id,
                          "discharge_power",
                          Number(e.target.value),
                        )
                      }
                    />
                  </Table.Cell>

                  {/* Remove Save Cell */}
                </Table.Row>
              )
            })}

            {/* --- Render 'Add New' Row Template --- */}
            {/* Only show 'Add New' row if there are less than 24 used slots */}
            {nextRecNoDisplay <= 24 && (
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
                      onChange={(e) =>
                        handleNewRowChange(
                          "start_time",
                          `${e.target.value || "00:00"}:00`,
                        )
                      }
                    />
                  </Field.Root>
                </Table.Cell>
                <Table.Cell>
                  {/* End time is implicit */}
                  <Input
                    type="time"
                    size="sm"
                    readOnly
                    placeholder="--"
                    bg="gray.100"
                  />
                </Table.Cell>
                <Table.Cell textAlign="end">
                  <Checkbox.Root
                    variant="outline"
                    checked={newRow.charge_enable}
                    onCheckedChange={(e) =>
                      handleNewRowChange("charge_enable", e.checked)
                    }
                  >
                    <Checkbox.HiddenInput />
                    <Checkbox.Control />
                  </Checkbox.Root>
                </Table.Cell>
                <Table.Cell textAlign="end">
                  <Checkbox.Root
                    variant="outline"
                    checked={newRow.charge_from_grid}
                    onCheckedChange={(e) =>
                      handleNewRowChange("charge_from_grid", e.checked)
                    }
                  >
                    <Checkbox.HiddenInput />
                    <Checkbox.Control />
                  </Checkbox.Root>
                </Table.Cell>
                <Table.Cell textAlign="end">
                  <Checkbox.Root
                    variant="outline"
                    checked={newRow.discharge_enable}
                    onCheckedChange={(e) =>
                      handleNewRowChange("discharge_enable", e.checked)
                    }
                  >
                    <Checkbox.HiddenInput />
                    <Checkbox.Control />
                  </Checkbox.Root>
                </Table.Cell>
                <Table.Cell textAlign="end">
                  <Checkbox.Root
                    variant="outline"
                    checked={newRow.allow_to_sell}
                    onCheckedChange={(e) =>
                      handleNewRowChange("allow_to_sell", e.checked)
                    }
                  >
                    <Checkbox.HiddenInput />
                    <Checkbox.Control />
                  </Checkbox.Root>
                </Table.Cell>
                <Table.Cell textAlign="end">
                  <Input
                    type="number"
                    size="sm"
                    w="100px"
                    value={newRow.charge_power}
                    onChange={(e) =>
                      handleNewRowChange("charge_power", Number(e.target.value))
                    }
                  />
                </Table.Cell>
                <Table.Cell textAlign="end">
                  <Input
                    type="number"
                    size="sm"
                    w="100px"
                    value={newRow.charge_limit}
                    onChange={(e) =>
                      handleNewRowChange("charge_limit", Number(e.target.value))
                    }
                  />
                </Table.Cell>
                <Table.Cell textAlign="end">
                  <Input
                    type="number"
                    size="sm"
                    w="100px"
                    value={newRow.discharge_power}
                    onChange={(e) =>
                      handleNewRowChange(
                        "discharge_power",
                        Number(e.target.value),
                      )
                    }
                  />
                </Table.Cell>
                <Table.Cell>
                  <IconButton
                    aria-label="Add Row"
                    size="sm"
                    colorScheme="green"
                    onClick={handleAddRow}
                  >
                    <LuPlus />
                  </IconButton>
                </Table.Cell>
              </Table.Row>
            )}
          </Table.Body>
        </Table.Root>
      </Box>
      {/* --- Render 'Add New' Row Template --- */}
      <Flex justify="flex-end" mt={4}>
        <Button
          colorScheme="blue"
          onClick={handleSaveAll}
          loading={isSaving}
          // Disable if there are validation errors
          disabled={invalidRows.length > 0 || isSaving}
        >
          Save All Changes
        </Button>
      </Flex>
    </VStack>
  )
}

export default ScheduleControlTable
