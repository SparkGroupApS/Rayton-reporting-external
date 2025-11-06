// src/components/Dashboard/ScheduleControlTable.tsx

import {
  Box,
  Button,
  Flex,
  Spinner,
  Table, // This is now the main namespace
  Text,
  VStack,
  Icon, // Import the Chakra Icon wrapper
} from "@chakra-ui/react";
// --- NEW: Import icons from react-icons ---
import { FaCheckCircle, FaTimesCircle } from "react-icons/fa";
import { CgSpinner } from "react-icons/cg";
// --- END NEW ---
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import type { ApiError, ScheduleRow, CommandResponse } from "@/client";
import { toaster } from "@/components/ui/toaster";
import { useBulkUpdateSchedule, useGetSchedule } from "@/hooks/useScheduleQueries";
import RowForm from "./ScheduleControlTable/RowForm";
import AddRowForm from "./ScheduleControlTable/AddRowForm";
import { validateRows, timeToMinutes, sortScheduleRows, createNewScheduleRowTemplate } from "./ScheduleControlTable/validation";
import type { ScheduleControlTableProps, ScheduleDisplayRow } from "./ScheduleControlTable/types";
import { SCHEDULE_TABLE_MAX_ROWS } from "./ScheduleControlTable/constants";

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


const ScheduleControlTable = ({ tenantId, date, onScheduleDataChange }: ScheduleControlTableProps) => {
  // ... (all other code remains the same) ...
  // ... (useGetSchedule, useBulkUpdateSchedule, localData, etc) ...

 const {
    data: serverData,
    isLoading: loadingSchedule,
    error,
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
      validateRows(cleanedData); 
    } else {
      setLocalData([]);
      setInvalidRows([]);
    }
    setNewRow(createNewScheduleRowTemplate());
  }, [serverData]);

  useEffect(() => {
    if (!tenantId) return;

    // --- FIX for import.meta: More robust check for esbuild environments ---
    const viteBackendUrl = (typeof import.meta === 'object' && import.meta.env) ? import.meta.env.VITE_BACKEND_URL : undefined;
    const procBackendUrl = (typeof process === 'object' && process.env) ? process.env.VITE_BACKEND_URL : undefined;
    const backendUrl = viteBackendUrl || procBackendUrl || window.location.origin.replace(':5173', ':8000');
    
    const viteApiUrl = (typeof import.meta === 'object' && import.meta.env) ? import.meta.env.VITE_API_V1_STR : undefined;
    const procApiUrl = (typeof process === 'object' && process.env) ? process.env.VITE_API_V1_STR : undefined;
    const apiUrl = viteApiUrl || procApiUrl || '/api/v1';
    // --- END FIX ---
    
    const wsProtocol = backendUrl.startsWith('https://') ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${backendUrl.replace(/^https?:\/\//, '')}${apiUrl}/ws/${tenantId}`;
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('WebSocket connected');
      setWsConnected(true);
    };
    
    ws.onmessage = (event) => {
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
          } else {
            setCommandStatus({ status: 'failed', message: `Command failed: ${data.error || 'Unknown error'}` });
          }
          
          commandMessageIdRef.current = null;
          
          setTimeout(() => {
            setCommandStatus({ status: 'idle' });
          }, 3000);
        } else if (data.type === 'command_response') {
          console.warn(`Ignored command response for old/mismatched message_id: ${data.message_id}`);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setWsConnected(false);
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setWsConnected(false);
    };
    
    setWsConnection(ws);
    
    return () => {
      if (ws) {
        ws.close();
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

    const sorted = sortScheduleRows(localData);
    const potentialNextStartTime = newRow.start_time;
    const potentialNextStartMinutes = timeToMinutes(potentialNextStartTime);

    return sorted.map((row, index) => {
      let nextDistinctStartTime: string;
      const currentRowStartTime = row.start_time;

      if (index === sorted.length - 1) {
        const firstRowStartTime = sorted[0]?.start_time ?? "00:00:00";
        if (potentialNextStartMinutes !== -1 && potentialNextStartMinutes > timeToMinutes(currentRowStartTime)) {
          nextDistinctStartTime = potentialNextStartTime;
        } else {
          nextDistinctStartTime = firstRowStartTime;
        }
      } else {
        nextDistinctStartTime = "00:00:00"; 
        for (let j = 1; j < sorted.length; j++) {
          const nextCheckIndex = (index + j) % sorted.length;
          if (sorted[nextCheckIndex].start_time !== currentRowStartTime) {
            nextDistinctStartTime = sorted[nextCheckIndex].start_time;
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
      const isValid = validateRows(updated);
      if (isValid) {
        setInvalidRows([]);
      }
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
      const isValid = validateRows(newData); 
      if (isValid) {
        setInvalidRows([]);
      }
      return newData; 
    });
    setNewRow(createNewScheduleRowTemplate()); 
    setIsNewRowStartTimeInvalid(false); 
  };


  // --- Save All Changes ---
  const handleSaveAll = () => {
    if (commandTimeoutIdRef.current) {
      clearTimeout(commandTimeoutIdRef.current);
      commandTimeoutIdRef.current = null;
    }

    const isValid = validateRows(localData);
    if (!isValid) {
      toaster.create({
        title: "Invalid Data",
        description: "Please fix duplicate start times (highlighted in red).",
        type: "error",
      });
      return;
    }

    const sortedData = sortScheduleRows(localData);
    const dataToSave = sortedData
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

  const filteredDisplayData = displayData.filter((row) => row.rec_no === 1 || row.start_time !== "00:00:00");

  return (
    <VStack gap={0} align="stretch">
      {" "}
      {/* Wrap table and button */}
      <Box overflowX="auto">
        <Table.Root size="sm">
          {/* ... (Table.Header remains the same) ... */}
          <Table.Header bg="gray.100">
            <Table.Row>
              <Table.ColumnHeader>Rec</Table.ColumnHeader>
              <Table.ColumnHeader>Start</Table.ColumnHeader>
              <Table.ColumnHeader>End</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="end">Charge</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="end">From Grid</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="end">Discharge</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="end">Sell</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="end">Charge Power</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="end">Charge Limit</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="end">Discharge Power</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {filteredDisplayData.map((row) => (
              <RowForm key={row.id} row={row} invalidRows={invalidRows} handleChange={handleChange} />
            ))}

            {nextRecNoDisplay <= SCHEDULE_TABLE_MAX_ROWS && (
              <AddRowForm
                newRow={newRow}
                isNewRowStartTimeInvalid={isNewRowStartTimeInvalid}
                nextRecNoDisplay={nextRecNoDisplay}
                handleNewRowChange={handleNewRowChange}
                handleAddRow={handleAddRow}
              />
            )}
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
          Save All Changes
        </Button>
      </Flex>
      {/* --- END CHANGE --- */}
    </VStack>
  );
};

export default ScheduleControlTable;