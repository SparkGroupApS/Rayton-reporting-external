// src/components/Dashboard/ScheduleControlTable_light.tsx

import {
  Box,
  Button,
  Flex,
  Icon,
  Spinner,
  Table, // This is now the main namespace
  Text,
  VStack,
} from "@chakra-ui/react";
// --- NEW: Import icons from react-icons ---
import { CgSpinner } from "react-icons/cg";
import { FaCheckCircle, FaTimesCircle } from "react-icons/fa";
// --- END NEW ---
import type { CommandResponse, ScheduleRow } from "@/client";
import { toaster } from "@/components/ui/toaster";
import { useBulkUpdateSchedule, useGetSchedule } from "@/hooks/useScheduleQueries";
import { useQueryClient } from "@tanstack/react-query"; // <-- Add queryClient import
import { useEffect, useMemo, useRef, useState } from "react";
import { SCHEDULE_TABLE_MAX_ROWS } from "./ScheduleControlTable/constants";
//import RowForm from "./ScheduleControlTable/RowForm";
import RowFormLight from "./ScheduleControlTable/RowForm_light";
import type { ScheduleControlTableProps, ScheduleDisplayRow } from "./ScheduleControlTable/types";
import { createNewScheduleRowTemplate, timeToMinutes, validateRows } from "./ScheduleControlTable/validation";

// --- NEW: A small component to display command status with icons ---
const CommandStatusDisplay = ({ status, message }: { status: 'idle' | 'sending' | 'success' | 'failed', message?: string }) => {
  if (status === 'idle') {
    return null;
  }

  if (status === 'sending') {
    return (
      <Flex alignItems="center" gap={2} color="blue.500" minW="220px">
        {/* Use CgSpinner inside Chakra's Icon component, and add animation */}
        <Icon
          as={CgSpinner}
          animation="spin 1s linear infinite"
          fontSize="lg"
        />
        <Text fontSize="sm" fontStyle="italic">{message || 'Sending...'}</Text>
      </Flex>
    );
  }

  if (status === 'success') {
    return (
      <Flex alignItems="center" gap={2} color="green.500" minW="220px">
        <Icon as={FaCheckCircle} fontSize="lg" />
        <Text fontSize="sm" fontWeight="medium">{message || 'Success'}</Text>
      </Flex>
    );
  }

  if (status === 'failed') {
    return (
      <Flex alignItems="center" gap={2} color="red.500" minW="220px">
        <Icon as={FaTimesCircle} fontSize="lg" />
        <Text fontSize="sm" fontWeight="medium">{message || 'Failed'}</Text>
      </Flex>
    );
  }

  return null;
};
// --- END NEW COMPONENT ---


const ScheduleControlTableLight = ({ tenantId, date, onScheduleDataChange }: ScheduleControlTableProps) => {
  const queryClient = useQueryClient(); // <-- Get query client instance
  // ... (all other code remains the same) ...
  // ... (useGetSchedule, useBulkUpdateSchedule, localData, etc) ...

 const {
    data: serverData,
    isLoading: loadingSchedule,
    error,
    dataUpdatedAt,
  } = useGetSchedule({ tenantId, date });

  const { mutate: bulkUpdateSchedule, isPending: isSaving } = useBulkUpdateSchedule({ tenantId, date });

  const [localData, setLocalData] = useState<ScheduleRow[]>([]);

 const [invalidRows, setInvalidRows] = useState<number[]>([]);
  const [newRow, setNewRow] = useState(createNewScheduleRowTemplate());
  const [isNewRowStartTimeInvalid, setIsNewRowStartTimeInvalid] = useState(false);

  const [commandStatus, setCommandStatus] = useState<{ status: 'idle' | 'sending' | 'success' | 'failed', message?: string }>({ status: 'idle' });

  const commandTimeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  const commandMessageIdRef = useRef<string | null>(null);

  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);
  const [wsConnected, setWsConnected] = useState<boolean>(false);

  useEffect(() => {
    if (serverData) {
      const cleanedData = serverData.map((row) => ({
        ...row,
        end_time: null,
      }));
      setLocalData(cleanedData);
      const invalidIds = validateRows(cleanedData);
      setInvalidRows(invalidIds);
    } else {
      setLocalData([]);
      setInvalidRows([]);
    }
    setNewRow(createNewScheduleRowTemplate());
  }, [serverData, dataUpdatedAt]);

  useEffect(() => {
    if (!tenantId) return;

    // Use relative path for API, matching VITE_API_URL=""
    const apiUrl = '/api/v1';

    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let isUnmounted = false;

    const connectWebSocket = () => {
      if (isUnmounted) return;

      // Close any existing connection before creating a new one
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close(1000, "New connection requested");
      }

      // const wsProtocol = backendUrl.startsWith('https://') ? 'wss:' : 'ws:';
      // const wsUrl = `${wsProtocol}//${backendUrl.replace(/^https?:\/\//, '')}${apiUrl}/ws/${tenantId}`;
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.host}${apiUrl}/ws/${tenantId}`;

      try {
        ws = new WebSocket(wsUrl);
        setWsConnection(ws); // Update the state with the new WebSocket connection

        ws.onopen = () => {
          if (isUnmounted) return;
          console.log('WebSocket connected');
          setWsConnected(true);
        };

        ws.onmessage = (event) => {
          if (isUnmounted) return;
          try {
            const data = JSON.parse(event.data);
            console.log('Received WebSocket message:', data);

            if (data.type === 'command_response' && data.message_id === commandMessageIdRef.current) {

              if (commandTimeoutIdRef.current) {
                clearTimeout(commandTimeoutIdRef.current);
                commandTimeoutIdRef.current = null;
              }

              if (data.status === 'ok' || data.status === 'success') {
                setCommandStatus({ status: 'success', message: 'Command confirmed' });
                // Invalidate the query to refetch the updated data from the server
                queryClient.invalidateQueries({
                  queryKey: ["schedule", { tenantId, date }],
                });
              } else {
                setCommandStatus({ status: 'failed', message: `Command failed: ${data.error || 'Unknown error'}` });
              }

              commandMessageIdRef.current = null;

              setTimeout(() => {
                if (!isUnmounted) {
                  setCommandStatus({ status: 'idle' });
                }
              }, 3000);
            } else if (data.type === 'command_response') {
              console.warn(`Ignored command response for old/mismatched message_id: ${data.message_id}`);
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        ws.onclose = (event) => {
          if (isUnmounted) return;
          console.log('WebSocket disconnected', event.code, event.reason);
          setWsConnected(false);

          // Attempt to reconnect after a delay, unless it was a deliberate close
          if (event.code !== 1000 && !isUnmounted) { // 1000 is normal closure
            reconnectTimeout = setTimeout(() => {
              if (!isUnmounted) {
                connectWebSocket();
              }
            }, 3000); // Reconnect after 3 seconds
          }
        };

        ws.onerror = (error) => {
          if (isUnmounted) return;
          console.error('WebSocket error:', error);
          setWsConnected(false);
        };
      } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
        if (!isUnmounted) {
          // Attempt to reconnect after a delay
          reconnectTimeout = setTimeout(() => {
            if (!isUnmounted) {
              connectWebSocket();
            }
          }, 3000);
        }
      }
    };

    connectWebSocket();

    return () => {
      isUnmounted = true;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close(1000, "Component unmounting"); // 1000 indicates normal closure
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (commandTimeoutIdRef.current) {
        clearTimeout(commandTimeoutIdRef.current);
      }
    };
  }, [tenantId]);

  useEffect(() => {
    if (onScheduleDataChange) {
      onScheduleDataChange(localData);
    }
  }, [localData, onScheduleDataChange]);

  // ... (displayData, nextRecNoDisplay, handleChange, handleNewRowChange, handleAddRow logic remains the same) ...

  const displayData = useMemo((): ScheduleDisplayRow[] => {
    if (localData.length === 0) return [];

    // Keep data in rec_no ascending order instead of sorting by start_time
    const ordered = [...localData].sort((a, b) => a.rec_no - b.rec_no);
    const potentialNextStartTime = newRow.start_time;
    const potentialNextStartMinutes = timeToMinutes(potentialNextStartTime);

    return ordered.map((row, index) => {
      let nextDistinctStartTime: string;
      const currentRowStartTime = row.start_time;

      // If this is a padding record (start_time is "00:00:00" and rec_no > 1), set end time to "00:00:00"
      if (currentRowStartTime === "00:00:00" && row.rec_no > 1) {
        nextDistinctStartTime = "00:00:00";
      } else if (index === ordered.length - 1) {
        const firstRowStartTime = ordered[0]?.start_time ?? "00:00:00";
        if (potentialNextStartMinutes !== -1 && potentialNextStartMinutes > timeToMinutes(currentRowStartTime)) {
          nextDistinctStartTime = potentialNextStartTime;
        } else {
          nextDistinctStartTime = firstRowStartTime;
        }
      } else {
        nextDistinctStartTime = "00:00:00";
        for (let j = 1; j < ordered.length; j++) {
          const nextCheckIndex = (index + j) % ordered.length;
          if (ordered[nextCheckIndex].start_time !== currentRowStartTime) {
            nextDistinctStartTime = ordered[nextCheckIndex].start_time;
            break;
          }
        }
      }
      return {
        ...row,
        displayEndTime: nextDistinctStartTime,
      };
    });
  }, [localData, newRow.start_time]);

  const nextRecNoDisplay = useMemo(() => {
    const usedRows = localData.filter((row) => row.rec_no === 1 || row.start_time !== "00:00:00");
    const lastUsedRecNo = usedRows.length > 0 ? Math.max(...usedRows.map((r) => r.rec_no)) : 0;
    return lastUsedRecNo + 1;
  }, [localData]);

  const handleChange = (id: number, field: keyof ScheduleRow, value: any) => {
    setLocalData((prev) => {
      const updated = prev.map((row) => (row.id === id ? { ...row, [field]: value } : row));
      const invalidIds = validateRows(updated);
      setInvalidRows(invalidIds);
      return updated;
    });
  };

  const handleNewRowChange = (field: keyof Omit<ScheduleRow, "id" | "updated_at" | "rec_no">, value: any) => {
    setNewRow((prev) => ({ ...prev, [field]: value }));

    if (field === "start_time") {
      const newStartTime = value as string;
      const isValidFormat = timeToMinutes(newStartTime) !== -1;
      const isDuplicate = localData.some((row) => row.start_time === newStartTime);
      setIsNewRowStartTimeInvalid(!isValidFormat || isDuplicate);
    }
  };

  const handleAddRow = () => {
    if (isNewRowStartTimeInvalid) {
      const isValidFormat = timeToMinutes(newRow.start_time) !== -1;
      if (!isValidFormat) {
        toaster.create({
          title: "Invalid Start Time",
          description: "Please enter a valid start time.",
          type: "error",
        });
      } else {
        toaster.create({
          title: "Duplicate Start Time",
          description: "A schedule entry already exists for this start time.",
          type: "warning",
        });
      }
      return;
    }

    const usedRows = localData.filter((row) => row.rec_no === 1 || row.start_time !== "00:00:00");
    const lastUsedRecNo = usedRows.length > 0 ? Math.max(...usedRows.map((r) => r.rec_no)) : 0;
    const nextRecNo = lastUsedRecNo + 1;

    if (nextRecNo > SCHEDULE_TABLE_MAX_ROWS) {
      toaster.create({
        title: "Limit Reached",
        description: "Cannot add more than 24 schedule entries.",
        type: "warning",
      });
      return;
    }

    const tempRow: ScheduleRow = {
      ...newRow,
      rec_no: nextRecNo,
      id: -Date.now(),
      updated_at: new Date().toISOString(),
      updated_by: "",
    };

    setLocalData((prev) => {
      const newData = [...prev, tempRow];
      const invalidIds = validateRows(newData);
      setInvalidRows(invalidIds);
      return newData;
    });
    setNewRow(createNewScheduleRowTemplate());
    setIsNewRowStartTimeInvalid(false);
  };


  // --- Зберегти зміни ---
  const handleSaveAll = () => {
    if (commandTimeoutIdRef.current) {
      clearTimeout(commandTimeoutIdRef.current);
      commandTimeoutIdRef.current = null;
    }

    const invalidIds = validateRows(localData);
    if (invalidIds.length > 0) {
      toaster.create({
        title: "Invalid Data",
        description: "Please fix duplicate start times (highlighted in red).",
        type: "error",
      });
      return;
    }

    // Keep data in rec_no ascending order instead of sorting by start_time
    const orderedData = [...localData].sort((a, b) => a.rec_no - b.rec_no);
    const dataToSave = orderedData
      .filter((row) => row.rec_no === 1 || row.start_time !== "00:00:00")
      .map((row, index) => ({
        ...row,
        rec_no: index + 1,
        end_time: null,
      }));

    const defaultRowValues = createNewScheduleRowTemplate();
    while (dataToSave.length < SCHEDULE_TABLE_MAX_ROWS) {
      dataToSave.push({
        ...defaultRowValues,
        id: -(Date.now() + dataToSave.length),
        rec_no: dataToSave.length + 1,
        updated_at: new Date().toISOString(),
        end_time: null,
        updated_by: "",
      });
    }

    setCommandStatus({ status: 'sending', message: 'Sending command...' });

    bulkUpdateSchedule(dataToSave, {
      onSuccess: (response: CommandResponse) => {
        const messageId = response.message_id;

        if (messageId) {
          commandMessageIdRef.current = messageId;

          const timeoutId = setTimeout(() => {
            if (commandMessageIdRef.current === messageId) {
              setCommandStatus({ status: 'failed', message: 'Command failed (timeout)' });
              commandTimeoutIdRef.current = null;
              commandMessageIdRef.current = null;
            }
          }, 10000);

          commandTimeoutIdRef.current = timeoutId;

          // --- CHANGE: Set status to 'success' with a waiting message ---
          // This will show the green checkmark and "Command sent...",
          // which will later be replaced by "Command confirmed"
          setCommandStatus({ status: 'success', message: 'Command sent, awaiting confirmation...' });

        } else {
          setCommandStatus({ status: 'success', message: 'Changes saved (no msg_id)' });
          setTimeout(() => {
            setCommandStatus({ status: 'idle' });
          }, 3000);
        }
      },
      onError: (error: Error) => {
        setCommandStatus({ status: 'failed', message: 'Command failed to send' });
        setTimeout(() => {
          setCommandStatus({ status: 'idle' });
        }, 3000);

        toaster.create({
          title: "Save Failed",
          description: error.message || "Could not save schedule.",
          type: "error",
        });
      },
    });
 };

  if (loadingSchedule) {
    return (
      <Flex justify="center" align="center" h="200px">
        <Spinner />
      </Flex>
    );
  }
  if (error) {
    return <Text color="red.500">Error loading schedule: {error.message}</Text>;
  }

  //const filteredDisplayData = displayData.filter((row) => row.rec_no === 1 || row.start_time !== "00:00:00");

  return (
    <VStack gap={0} align="stretch">
      {" "}
      {/* Wrap table and button */}
      <Box overflowX="auto">
        <Table.Root size="sm"  >
          {/* ... (Table.Header remains the same) ... */}
          <Table.Header bg="gray.100">
            <Table.Row>
              <Table.ColumnHeader>Rec</Table.ColumnHeader>
              <Table.ColumnHeader>Start</Table.ColumnHeader>
              <Table.ColumnHeader>End</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="end">OffGrid</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="end">Charge Power</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="end">Charge Limit</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="end">Discharge Power</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {displayData.map((row) => ( //filteredDisplayData
              <RowFormLight key={row.id} row={row} invalidRows={invalidRows} handleChange={handleChange} />
            ))}

            {/* {nextRecNoDisplay <= SCHEDULE_TABLE_MAX_ROWS && (
              <AddRowForm
                newRow={newRow}
                isNewRowStartTimeInvalid={isNewRowStartTimeInvalid}
                nextRecNoDisplay={nextRecNoDisplay}
                handleNewRowChange={handleNewRowChange}
                handleAddRow={handleAddRow}
              />
            )} */}
          </Table.Body>
        </Table.Root>
      </Box>

      {/* --- CHANGE: Use the new CommandStatusDisplay component --- */}
      <Flex justify="flex-end" mt={4} gap={3} alignItems="center">
        <CommandStatusDisplay
          status={commandStatus.status}
          message={commandStatus.message}
        />
        <Button
          colorScheme="blue"
          onClick={handleSaveAll}
          loading={isSaving || commandStatus.status === 'sending'} // The button itself still shows its own spinner
          disabled={invalidRows.length > 0 || isSaving || commandStatus.status === 'sending'}>
          Зберегти зміни
        </Button>
      </Flex>
      {/* --- END CHANGE --- */}
    </VStack>
  );
};

export default ScheduleControlTableLight;
