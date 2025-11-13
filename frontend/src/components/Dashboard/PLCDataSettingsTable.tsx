// src/components/Dashboard/PLCDataSettingsTable.tsx

import {
  Box,
  Button,
  Flex,
  Spinner,
  Text,
  VStack,
  Icon, // Import the Chakra Icon wrapper
  SimpleGrid,
  Heading,
  Field,
  Input as ChakraInput,
  Card,
  NumberInput,
} from "@chakra-ui/react";

// --- NEW: Import icons from react-icons ---
import { FaCheckCircle, FaTimesCircle } from "react-icons/fa";
import { CgSpinner } from "react-icons/cg";
import { FaUndo } from "react-icons/fa"; // Import the undo icon for reverting values
// --- END NEW ---
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import type { ApiError, PlcDataSettingsExtendedRow, CommandResponse, SettingsUpdatePlcDataSettingsResponse } from "@/client";
import { toaster } from "@/components/ui/toaster";
import { useBulkUpdatePlcDataSettings, useGetPlcDataSettings } from "@/hooks/usePlcDataSettingsQueries";

// --- NEW: A small component to display command status with icons ---
const CommandStatusDisplay = ({ status, message }: { status: "idle" | "sending" | "success" | "failed"; message?: string }) => {
  if (status === "idle") {
    return null;
  }

  if (status === "sending") {
    return (
      <Flex alignItems="center" gap={2} color="blue.500" minW="20px">
        {/* Use CgSpinner inside Chakra's Icon component, and add animation */}
        <Icon as={CgSpinner} animation="spin 1s linear infinite" fontSize="lg" />
        <Text fontSize="sm" fontStyle="italic">
          {message || "Sending..."}
        </Text>
      </Flex>
    );
  }

  if (status === "success") {
    return (
      <Flex alignItems="center" gap={2} color="green.500" minW="220px">
        <Icon as={FaCheckCircle} fontSize="lg" />
        <Text fontSize="sm" fontWeight="medium">
          {message || "Success"}
        </Text>
      </Flex>
    );
  }

  if (status === "failed") {
    return (
      <Flex alignItems="center" gap={2} color="red.500" minW="220px">
        <Icon as={FaTimesCircle} fontSize="lg" />
        <Text fontSize="sm" fontWeight="medium">
          {message || "Failed"}
        </Text>
      </Flex>
    );
  }

  return null;
};
// --- END NEW COMPONENT ---

interface PLCDataSettingsTableProps {
  tenantId: string | null;
}

interface ValueChangeDetails {
  value: string | number;
  valueAsString: string;
  valueAsNumber: number;
}

interface ModifiedPlcDataRow extends PlcDataSettingsExtendedRow {
  originalData: number | null;
  isModified: boolean;
}

const PLCDataSettingsTable = ({ tenantId }: PLCDataSettingsTableProps) => {
  const { data: serverData, isLoading: loadingSettings, error, dataUpdatedAt } = useGetPlcDataSettings({ tenantId });

  const { mutate: bulkUpdatePlcDataSettings, isPending: isSaving } = useBulkUpdatePlcDataSettings({ tenantId });

  const [localData, setLocalData] = useState<ModifiedPlcDataRow[]>([]);

  const [commandStatus, setCommandStatus] = useState<{ status: "idle" | "sending" | "success" | "failed"; message?: string }>({ status: "idle" });

  const commandTimeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  const commandMessageIdRef = useRef<string | null>(null);

  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);
  const [wsConnected, setWsConnected] = useState<boolean>(false);

  useEffect(() => {
    if (serverData) {
      const mappedData = serverData.map((row) => ({
        ...row,
        originalData: row.data,
        isModified: false,
      }));
      setLocalData(mappedData);
    } else {
      setLocalData([]);
    }
  }, [serverData, dataUpdatedAt]);

  useEffect(() => {
    if (!tenantId) return;

    // Use relative path for API, matching VITE_API_URL=""
    const apiUrl = "/api/v1";

    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let isUnmounted = false;

    const connectWebSocket = () => {
      if (isUnmounted) return;

      // Close any existing connection before creating a new one
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close(100, "New connection requested");
      }

      // const wsProtocol = backendUrl.startsWith('https://') ? 'wss:' : 'ws:';
      // const wsUrl = `${wsProtocol}//${backendUrl.replace(/^https?:\/\//, '')}${apiUrl}/ws/${tenantId}`;
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${wsProtocol}//${window.location.host}${apiUrl}/ws/${tenantId}`;

      try {
        ws = new WebSocket(wsUrl);
        setWsConnection(ws); // Update the state with the new WebSocket connection

        ws.onopen = () => {
          if (isUnmounted) return;
          console.log("WebSocket connected");
          setWsConnected(true);
        };

        ws.onmessage = (event) => {
          if (isUnmounted) return;
          try {
            const data = JSON.parse(event.data);
            console.log("Received WebSocket message:", data);

            if (data.type === "command_response" && data.message_id === commandMessageIdRef.current) {
              if (commandTimeoutIdRef.current) {
                clearTimeout(commandTimeoutIdRef.current);
                commandTimeoutIdRef.current = null;
              }

              if (data.status === "ok" || data.status === "success") {
                setCommandStatus({ status: "success", message: "Command confirmed" });
              } else {
                setCommandStatus({ status: "failed", message: `Command failed: ${data.error || "Unknown error"}` });
              }

              commandMessageIdRef.current = null;

              setTimeout(() => {
                if (!isUnmounted) {
                  setCommandStatus({ status: "idle" });
                }
              }, 3000);
            } else if (data.type === "command_response") {
              console.warn(`Ignored command response for old/mismatched message_id: ${data.message_id}`);
            }
          } catch (error) {
            console.error("Error parsing WebSocket message:", error);
          }
        };

        ws.onclose = (event) => {
          if (isUnmounted) return;
          console.log("WebSocket disconnected", event.code, event.reason);
          setWsConnected(false);

          // Attempt to reconnect after a delay, unless it was a deliberate close
          if (event.code !== 100 && !isUnmounted) {
            // 100 is normal closure
            reconnectTimeout = setTimeout(() => {
              if (!isUnmounted) {
                connectWebSocket();
              }
            }, 30); // Reconnect after 3 seconds
          }
        };

        ws.onerror = (error) => {
          if (isUnmounted) return;
          console.error("WebSocket error:", error);
          setWsConnected(false);
        };
      } catch (error) {
        console.error("Failed to create WebSocket connection:", error);
        if (!isUnmounted) {
          // Attempt to reconnect after a delay
          reconnectTimeout = setTimeout(() => {
            if (!isUnmounted) {
              connectWebSocket();
            }
          }, 300);
        }
      }
    };

    connectWebSocket();

    return () => {
      isUnmounted = true;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close(100, "Component unmounting"); // 1000 indicates normal closure
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (commandTimeoutIdRef.current) {
        clearTimeout(commandTimeoutIdRef.current);
      }
    };
  }, [tenantId]);

  const handleChange = (id: number, value: string) => {
    setLocalData((prev) => {
      return prev.map((row) => {
        if (row.id === id) {
          const newValue = value === "" ? null : parseFloat(value);
          const isModified = newValue !== row.originalData;
          return { ...row, data: newValue, isModified };
        }
        return row;
      });
    });
  };

  const handleRevert = (id: number) => {
    setLocalData((prev) => {
      return prev.map((row) => {
        if (row.id === id) {
          return { ...row, data: row.originalData, isModified: false };
        }
        return row;
      });
    });
  };

  // --- Save All Changes ---
  const handleSaveAll = () => {
    if (commandTimeoutIdRef.current) {
      clearTimeout(commandTimeoutIdRef.current);
      commandTimeoutIdRef.current = null;
    }

    setCommandStatus({ status: "sending", message: "Sending command..." });

    // Filter to only send modified data
    const modifiedData = localData.filter(row => row.isModified);
    if (modifiedData.length === 0) {
      setCommandStatus({ status: "success", message: "No changes to save" });
      setTimeout(() => setCommandStatus({ status: "idle" }), 3000);
      return;
    }

    bulkUpdatePlcDataSettings(modifiedData, {
      onSuccess: (response: unknown) => {
        // Check if the response has message_id (CommandResponse) or is the data itself
        if (response && typeof response === "object" && "message_id" in response) {
          // This is a CommandResponse
          const commandResponse = response as CommandResponse;
          const messageId = commandResponse.message_id;

          if (messageId) {
            commandMessageIdRef.current = messageId;

            const timeoutId = setTimeout(() => {
              if (commandMessageIdRef.current === messageId) {
                setCommandStatus({ status: "failed", message: "Command failed (timeout)" });
                commandTimeoutIdRef.current = null;
                commandMessageIdRef.current = null;
              }
            }, 10000); // Increased timeout to 10 seconds

            commandTimeoutIdRef.current = timeoutId;

            // --- CHANGE: Set status to 'success' with a waiting message ---
            // This will show the green checkmark and "Command sent...",
            // which will later be replaced by "Command confirmed"
            setCommandStatus({ status: "success", message: "Command sent, awaiting confirmation..." });
          } else {
            setCommandStatus({ status: "success", message: "Changes saved (no msg_id)" });
            setTimeout(() => {
              setCommandStatus({ status: "idle" });
            }, 300);
          }
        } else {
          // If response doesn't have message_id, just show success
          setCommandStatus({ status: "success", message: "Changes saved" });
          setTimeout(() => {
            setCommandStatus({ status: "idle" });
          }, 3000);
        }
      },
      onError: (error: Error) => {
        setCommandStatus({ status: "failed", message: "Command failed to send" });
        setTimeout(() => {
          setCommandStatus({ status: "idle" });
        }, 300);

        toaster.create({
          title: "Save Failed",
          description: error.message || "Could not save settings.",
          type: "error",
        });
      },
    });
  };

  if (loadingSettings) {
    return (
      <Flex justify="center" align="center" h="200px">
        <Spinner />
      </Flex>
    );
  }
  if (error) {
    return <Text color="red.500">Error loading settings: {error.message}</Text>;
  }

  return (
    <VStack gap={6} align="stretch">
      {/* Dynamic inputs using SimpleGrid */}
      <SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 3, xl: 3 }} gap={{ base: "2", sm: "2", md: "2", lg: "4", xl: "4" }}>
        {localData.map((row) => (
          <Card.Root key={row.id} variant="outline" size="sm">
            <Card.Header pb={2}>
              <Heading size="sm" whiteSpace="normal" textOverflow="ellipsis" overflow="hidden">
                {row.data_text || `Data ${row.data_id}`} (ID: {row.id})
              </Heading>
            </Card.Header>
            <Card.Body pt={0}>
              <Field.Root>
                {/* <Field.Label fontSize="xs" mb={1}>
                  ID: {row.id}
                </Field.Label> */}
                <Flex alignItems="center" justifyContent="space-between" gap={2}>
                  <NumberInput.Root
                    flex="1"
                    value={row.data !== null && row.data !== undefined ? row.data.toString() : ""}
                    onValueChange={(details) => handleChange(row.id, details.value)}
                    min={0}>
                    <NumberInput.Input as={ChakraInput} />
                    <NumberInput.Control>
                      <NumberInput.IncrementTrigger />
                      <NumberInput.DecrementTrigger />
                    </NumberInput.Control>
                  </NumberInput.Root>
                  {row.isModified && (
                    <Icon as={FaUndo} boxSize={4} color="gray.500" cursor="pointer" onClick={() => handleRevert(row.id)} _hover={{ color: "blue.500" }} />
                  )}
                </Flex>
              </Field.Root>
            </Card.Body>
          </Card.Root>
        ))}
      </SimpleGrid>

      {/* Save button */}
      <Flex justify="flex-end" gap={3} alignItems="center">
        <CommandStatusDisplay status={commandStatus.status} message={commandStatus.message} />
        <Button
          colorScheme="blue"
          onClick={handleSaveAll}
          loading={isSaving || commandStatus.status === "sending"}
          disabled={isSaving || commandStatus.status === "sending"}>
          Save All Changes
        </Button>
      </Flex>
    </VStack>
  );
};

export default PLCDataSettingsTable;
