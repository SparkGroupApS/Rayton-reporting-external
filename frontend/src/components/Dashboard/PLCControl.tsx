// src/components/Dashboard/PLCControl.tsx

import {
  Button,
  Card,
  DataList,
  Input as ChakraInput,
  Field,
  Flex,
  Heading,
  Icon,
  NativeSelect,
  NumberInput,
  Text,
  VStack,
  HStack,
  SimpleGrid,
  Spinner,
  Switch,
  Slider,
  Box,
} from '@chakra-ui/react';

import { CgSpinner } from 'react-icons/cg';
import { FaCheckCircle, FaTimesCircle, FaUndo } from 'react-icons/fa';

import type {
  CommandResponse,
  PlcDataSettingsExtendedRow,
  PlcDataControlExtendedRow,
} from '@/client';
import { ControlService } from '@/client';
import { toaster } from '@/components/ui/toaster';
import {
  useBulkUpdatePlcDataControl,
  useGetPlcDataControl,
} from '@/hooks/usePlcControlQueries';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

// --- NEW: A small component to display command status with icons ---
const CommandStatusDisplay = ({
  status,
  message,
}: {
  status: 'idle' | 'sending' | 'sent' | 'confirmation_received' | 'failed';
  message?: string;
}) => {
  if (status === 'idle') {
    return null;
  }

  if (status === 'sending') {
    return (
      <Flex alignItems="center" gap={2} color="blue.500" minW="20px">
        <Icon
          as={CgSpinner}
          animation="spin 1s linear infinite"
          fontSize="lg"
        />
      </Flex>
    );
  }

  if (status === 'sent') {
    return (
      <Flex alignItems="center" gap={2} color="blue.500" minW="20px">
        <Icon as={CgSpinner} animation="spin 1s linear infinite" fontSize="lg" />
      </Flex>
    );
  }

  if (status === 'confirmation_received') {
    return (
      <Flex alignItems="center" gap={2} color="green.500" minW="20px">
        <Icon as={FaCheckCircle} fontSize="lg" />
      </Flex>
    );
  }

  if (status === 'failed') {
    return (
      <Flex alignItems="center" gap={2} color="red.500" minW="20px">
        <Icon as={FaTimesCircle} fontSize="lg" />
      </Flex>
    );
  }

  return null;
};
// --- END NEW COMPONENT ---

interface PLCControlProps {
  tenantId: string | null;
  isActive?: boolean; // <--- 1. Added isActive prop
}

interface ValueChangeDetails {
  value: string | number;
  valueAsString: string;
  valueAsNumber: number;
}

interface ModifiedPlcDataRow extends PlcDataControlExtendedRow {
  originalData: number | null;
  isModified: boolean;
}

const PLCControl = ({ tenantId, isActive }: PLCControlProps) => {
  const queryClient = useQueryClient();
  const {
    data: serverData,
    isLoading: loadingControl,
    error,
    dataUpdatedAt,
    refetch, // <--- 2. Destructure refetch
  } = useGetPlcDataControl({ tenantId });

  const { mutate: bulkUpdatePlcDataControl, isPending: isSaving } =
    useBulkUpdatePlcDataControl({ tenantId });

  // Store the original success and error handlers to reuse them
  const handleMutationSuccess = (response: any, controlRow: ModifiedPlcDataRow) => {
    // Handle success response with message_id
    if (
      response &&
      typeof response === 'object' &&
      'message_id' in response
    ) {
      const commandResponse = response as CommandResponse;
      const messageId = commandResponse.message_id;
      if (messageId) {
        // Set status to success with waiting message for this control, including the message ID
        setControlStatus((prev) => ({
          ...prev,
          [controlRow.id]: {
            status: 'sent',
            message: 'Sent',
            messageId: messageId, // Store the message ID for this control
          },
        }));
      }
    } else {
      // If response doesn't have message_id, just show success
      setControlStatus((prev) => ({
        ...prev,
        [controlRow.id]: { status: 'confirmation_received', message: 'Changes saved' },
      }));
      // Clear the status after a delay
      setTimeout(() => {
        setControlStatus((prev) => ({
          ...prev,
          [controlRow.id]: { status: 'idle' },
        }));
      }, 300);
    }
  };

  const handleMutationError = (error: Error, controlRow: ModifiedPlcDataRow) => {
    console.error('Failed to update single PLC data command', error);
    setControlStatus((prev) => ({
      ...prev,
      [controlRow.id]: {
        status: 'failed',
        message: 'Failed',
      },
    }));
    // Clear the status after a delay
    setTimeout(() => {
      setControlStatus((prev) => ({
        ...prev,
        [controlRow.id]: { status: 'idle' },
      }));
    }, 3000);
    toaster.create({
      title: 'Update Failed',
      description: error.message || 'Could not send command.',
      type: 'error',
    });
  };

  // Single update mutation hook for sending individual control changes over MQTT
  const singleUpdateMutation = useMutation({
    mutationFn: async (controlRow: ModifiedPlcDataRow) => {
      // Set status to sending for this control
      setControlStatus((prev) => ({
        ...prev,
        [controlRow.id]: { status: 'sending', message: 'Sending' },
      }));

      // Transform the data to send only the required fields [id, data, updated_by]
      const transformedData = [
        {
          id: controlRow.id, // Use the database ID as id for the update request
          data: controlRow.data,
          updated_by: controlRow.updated_by,
        },
      ];

      return ControlService.updatePlcControl({
        tenantId: tenantId!, // Pass tenantId
        requestBody: transformedData,
      });
    },

    onSuccess: handleMutationSuccess,
    onError: handleMutationError,
  });

  const [localData, setLocalData] = useState<ModifiedPlcDataRow[]>([]);

  // Individual status tracking for each control element
  const [controlStatus, setControlStatus] = useState<
    Record<
      number,
      {
        status: 'idle' | 'sending' | 'sent' | 'confirmation_received' | 'failed';
        message?: string;
        messageId?: string; // Added to track the message ID for each control
      }
    >
  >({});

  const commandTimeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  const commandMessageIdRef = useRef<string | null>(null);

  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);
  const [wsConnected, setWsConnected] = useState<boolean>(false);

  // Track ongoing requests to prevent duplicate calls for the same control ID
  const ongoingRequests = useRef<Set<number>>(new Set());
  // Track debounce timers for each control ID
  const debounceTimers = useRef<Record<number, NodeJS.Timeout>>({});

  const handleChange = (id: number, value: string | boolean | number) => {
    // Clear any existing debounce timer for this control
    if (debounceTimers.current[id]) {
      clearTimeout(debounceTimers.current[id]);
    }

    // Set a new debounce timer
    debounceTimers.current[id] = setTimeout(() => {
      setLocalData((prev) => {
        return prev.map((row) => {
          if (row.id === id) {
            let newValue: number | null;
            if (typeof value === 'boolean') {
              // For boolean inputs, convert to 1/0
              newValue = value ? 1 : 0;
            } else if (typeof value === 'number') {
              // For slider inputs, use the numeric value directly
              newValue = value;
            } else {
              // For textlist and number inputs
              if (row.input_type === 'textlist' && row.textlist_entries) {
                // For textlist inputs, find the numeric value that corresponds to the selected text
                const textToValue = Object.entries(row.textlist_entries).find(
                  ([key, text]) => text === value
                );
                newValue = textToValue ? parseFloat(textToValue[0]) : null;
              } else {
                // For number inputs
                newValue = value === '' ? null : parseFloat(value);
              }
            }
            const isModified = newValue !== row.originalData;
            const updatedRow = { ...row, data: newValue, isModified };

            // Send MQTT message immediately if control_type is 1, 145, 146, 141, or 142
            // But only if no request is currently ongoing for this control ID
            if ([1, 145, 146, 141, 142].includes(row.control_type)) {
              if (!ongoingRequests.current.has(row.id)) {
                // Mark this control as having an ongoing request
                ongoingRequests.current.add(row.id);

                // Create a callback to clear the ongoing request when mutation completes
                const clearOngoingRequest = () => {
                  ongoingRequests.current.delete(row.id);
                };

                // Mutate with callbacks to clear ongoing request and handle success/error
                singleUpdateMutation.mutate(updatedRow, {
                  onSuccess: (response, variables, context) => {
                    clearOngoingRequest();
                    // Call the original success handler
                    handleMutationSuccess(response, variables);
                  },
                  onError: (error, variables, context) => {
                    clearOngoingRequest();
                    // Call the original error handler
                    handleMutationError(error, variables);
                  }
                });
              }
            }

            return updatedRow;
          }
          return row;
        });
      });
    }, 30); // 300ms debounce delay
  };

  // --- 3. POLLING INTERVAL ---
  useEffect(() => {
    // Only poll if the tab is active
    if (!isActive) return;

    const intervalId = setInterval(() => {
      refetch();
    }, 2000); // 2 seconds

    return () => clearInterval(intervalId);
  }, [isActive, refetch]);
  // ---------------------------

  // --- 4. SMART STATE SYNC ---
  useEffect(() => {
    if (serverData) {
      setLocalData((prevData) => {
        // If we have no local data yet, just map everything
        if (prevData.length === 0) {
          return serverData.map((row) => ({
            ...row,
            originalData: row.data,
            isModified: false,
          }));
        }

        // If we do have local data, we merge.
        // We preserve user edits (rows where isModified is true)
        // and update non-modified rows with fresh server data.
        return serverData.map((serverRow) => {
          const existingRow = prevData.find((r) => r.id === serverRow.id);

          if (existingRow && existingRow.isModified) {
            // Keep the user's modified version, but update the 'originalData'
            // so if they revert, they revert to the latest server value?
            // OR keep originalData as the 'last known confirmed state'.
            // Usually, we just keep the user's pending edit.
            return existingRow;
          }

          // Otherwise, overwrite with new server data
          return {
            ...serverRow,
            originalData: serverRow.data,
            isModified: false,
          };
        });
      });
    } else {
      setLocalData([]);
    }
  }, [serverData, dataUpdatedAt]);
  // ---------------------------

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
        ws.close(100, 'New connection requested');
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

            if (
              data.type === 'command_response'
            ) {
              if (commandTimeoutIdRef.current) {
                clearTimeout(commandTimeoutIdRef.current);
                commandTimeoutIdRef.current = null;
              }

              // Find the control that matches the message ID and update its status
              setControlStatus((prev) => {
                const updatedStatus = { ...prev };
                let foundControl = false;

                for (const [id, status] of Object.entries(prev)) {
                  if (status.messageId === data.message_id) {
                    if (data.status === 'ok' || data.status === 'success') {
                      updatedStatus[parseInt(id)] = {
                        status: 'confirmation_received',
                        message: 'Saved',
                        messageId: data.message_id
                      };
                    } else {
                      updatedStatus[parseInt(id)] = {
                        status: 'failed',
                        message: 'Failed',
                        messageId: data.message_id
                      };
                    }

                    // Set timeout to clear status after showing result
                    setTimeout(() => {
                      setControlStatus((prev) => ({
                        ...prev,
                        [parseInt(id)]: { status: 'idle' },
                      }));
                    }, 3000);

                    foundControl = true;
                    break;
                  }
                }

                if (!foundControl) {
                  console.warn(`No control found for message_id: ${data.message_id}`);
                }

                return updatedStatus;
              });

              // Invalidate the query to refetch the updated data from the server
              if (data.status === 'ok' || data.status === 'success') {
                queryClient.invalidateQueries({
                  queryKey: ['plcDataControl', { tenantId }],
                });
              }
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
          if (event.code !== 10 && !isUnmounted) {
            // 100 is normal closure
            // 10 is likely typo in your original code (should be 1000 or 1001?) assuming 1000 is intentional close
            reconnectTimeout = setTimeout(() => {
              if (!isUnmounted) {
                connectWebSocket();
              }
            }, 30); // Reconnect after 3 seconds
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
          }, 300);
        }
      }
    };

    connectWebSocket();

    return () => {
      isUnmounted = true;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close(1000, 'Component unmounting'); // 1000 indicates normal closure
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (commandTimeoutIdRef.current) {
        clearTimeout(commandTimeoutIdRef.current);
      }

      // Clear any remaining debounce timers to prevent memory leaks
      Object.values(debounceTimers.current).forEach(timer => {
        if (timer) {
          clearTimeout(timer);
        }
      });
    };
  }, [tenantId]);

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

  // Handle button click for control_type 141 (state button)
  const handleStateButtonClick = (id: number) => {
    // Clear any existing debounce timer for this control
    if (debounceTimers.current[id]) {
      clearTimeout(debounceTimers.current[id]);
    }

    // Set a new debounce timer
    debounceTimers.current[id] = setTimeout(() => {
      setLocalData((prev) => {
        return prev.map((row) => {
          if (row.id === id) {
            // Toggle between 0 and 1
            const newValue = row.data === 1 ? 0 : 1;
            const isModified = newValue !== row.originalData;
            const updatedRow = { ...row, data: newValue, isModified };

            // Send MQTT message immediately if control_type is 141
            // But only if no request is currently ongoing for this control ID
            if (row.control_type === 141) {
              if (!ongoingRequests.current.has(row.id)) {
                // Mark this control as having an ongoing request
                ongoingRequests.current.add(row.id);

                // Create a callback to clear the ongoing request when mutation completes
                const clearOngoingRequest = () => {
                  ongoingRequests.current.delete(row.id);
                };

                // Mutate with callbacks to clear ongoing request and handle success/error
                singleUpdateMutation.mutate(updatedRow, {
                  onSuccess: (response, variables, context) => {
                    clearOngoingRequest();
                    // Call the original success handler
                    handleMutationSuccess(response, variables);
                  },
                  onError: (error, variables, context) => {
                    clearOngoingRequest();
                    // Call the original error handler
                    handleMutationError(error, variables);
                  }
                });
              }
            }

            return updatedRow;
          }
          return row;
        });
      });
    }, 30); // 30ms debounce delay
  };

  // Handle button click for control_type 142 (dual buttons)
  const handleDualButtonClick = (id: number, value: number) => {
    // Clear any existing debounce timer for this control
    if (debounceTimers.current[id]) {
      clearTimeout(debounceTimers.current[id]);
    }

    // Set a new debounce timer
    debounceTimers.current[id] = setTimeout(() => {
      setLocalData((prev) => {
        return prev.map((row) => {
          if (row.id === id) {
            const isModified = value !== row.originalData;
            const updatedRow = { ...row, data: value, isModified };

            // Send MQTT message immediately if control_type is 142
            // But only if no request is currently ongoing for this control ID
            if (row.control_type === 142) {
              if (!ongoingRequests.current.has(row.id)) {
                // Mark this control as having an ongoing request
                ongoingRequests.current.add(row.id);

                // Create a callback to clear the ongoing request when mutation completes
                const clearOngoingRequest = () => {
                  ongoingRequests.current.delete(row.id);
                };

                // Mutate with callbacks to clear ongoing request and handle success/error
                singleUpdateMutation.mutate(updatedRow, {
                  onSuccess: (response, variables, context) => {
                    clearOngoingRequest();
                    // Call the original success handler
                    handleMutationSuccess(response, variables);
                  },
                  onError: (error, variables, context) => {
                    clearOngoingRequest();
                    // Call the original error handler
                    handleMutationError(error, variables);
                  }
                });
              }
            }

            return updatedRow;
          }
          return row;
        });
      });
    }, 30); // 30ms debounce delay
  };

  if (loadingControl) {
    return (
      <Flex justify="center" align="center" h="200px">
        <Spinner />
      </Flex>
    );
  }
  if (error) {
    return <Text color="red.500">Error loading data: {error.message}</Text>;
  }

  // Filter data for the two blocks
  const statusData = localData
    .filter((row) => row.control_type === 2 || row.control_type === 3)
    .sort((a, b) => {
      // Define the hardcoded order: 3, 2
      const order = [3, 2];
      return order.indexOf(a.control_type) - order.indexOf(b.control_type);
    });

  const controlData = localData
    .filter(
      (row) =>
        row.control_type === 1 ||
        row.control_type === 145 ||
        row.control_type === 146 ||
        row.control_type === 141 ||
        row.control_type === 142
    )
    .sort((a, b) => {
      // Define the hardcoded order
      const order = [145, 146, 1, 141, 142];
      return order.indexOf(a.control_type) - order.indexOf(b.control_type);
    });

  return (
    <VStack gap={6} align="stretch">
      {/* 1st block - Statuses (control_type = 2, 3) */}
      {statusData.length > 0 && (
        <Box borderWidth="1px" borderRadius="lg" p={4} bg="gray.50">
          <Heading size="md" mb={4}>
            Статус
          </Heading>
          <DataList.Root orientation="horizontal" divideY="1px" maxW="md">
            {statusData.map((row) => (
              <DataList.Item key={row.id} pt="4">
                <DataList.ItemLabel
                  whiteSpace="normal"
                  textOverflow="ellipsis"
                  overflow="hidden"
                  fontSize={{ base: 'xs', sm: 'sm' }}
                >
                  {row.data_text || `Data ${row.data_id}`} (ID: {row.data_id}):
                </DataList.ItemLabel>
                <DataList.ItemValue>
                  <Field.Root>
                    <Flex
                      alignItems="center"
                      justifyContent="space-between"
                      gap={2}
                      flexDir={{ base: 'column', md: 'row' }}
                    >
                      <Flex flex="1" w="100%" minW="0">
                        {' '}
                        {/* Ensure flex item doesn't overflow */}
                        {(() => {
                          // Control type specific rendering for statuses
                          switch (row.control_type) {
                            // Read-only text for control_type 2 and 3
                            case 2:
                            case 3:
                              // Look up the text from textlist_entries if available
                              const displayText =
                                row.textlist_entries &&
                                row.data !== null &&
                                row.data !== undefined
                                  ? row.textlist_entries[row.data.toString()] ||
                                    row.data.toString()
                                  : row.data !== null && row.data !== undefined
                                    ? row.data.toString()
                                    : 'N/A';

                              return (
                                <Text
                                  w="100%"
                                  wordBreak="break-word"
                                  //bg="gray.50"
                                  //borderRadius="md"
                                  //border="1px solid"
                                  //borderColor="gray.200"
                                >
                                  {displayText}
                                </Text>
                              );

                            default:
                              return null;
                          }
                        })()}
                      </Flex>
                      {row.isModified && (
                        <Icon
                          as={FaUndo}
                          boxSize={4}
                          color="gray.500"
                          cursor="pointer"
                          onClick={() => handleRevert(row.id)}
                          _hover={{ color: 'blue.500' }}
                          alignSelf="flex-start"
                          mt={{ base: 2, md: 0 }}
                        />
                      )}
                    </Flex>
                  </Field.Root>
                </DataList.ItemValue>
              </DataList.Item>
            ))}
          </DataList.Root>
        </Box>
      )}

      {/* 2nd block - Controlling (control_type = 1, 146, 141, 142, 'Save' button) */}
      {(controlData.length > 0 || true) && (
        <Box borderWidth="1px" borderRadius="lg" p={4} bg="gray.50">
          <Heading size="md" mb={4}>
            Керування
          </Heading>
          <SimpleGrid
            columns={{ base: 1, sm: 1, md: 2, lg: 3, xl: 3 }}
            gap={{ base: '2', sm: '2', md: '3', lg: '4', xl: '4' }}
          >
            {controlData.map((row) => (
              <Card.Root key={row.id} variant="outline" size="sm">
                <Card.Header pb={2}>
                  <Heading
                    size="sm"
                    whiteSpace="normal"
                    textOverflow="ellipsis"
                    overflow="hidden"
                    fontSize={{ base: 'xs', sm: 'sm' }}
                  >
                    {row.data_text || `Data ${row.data_id}`} (ID: {row.data_id})
                  </Heading>
                </Card.Header>
                <Card.Body pt={0}>
                  <Field.Root>
                    <Flex
                      alignItems="center"
                      justifyContent="space-between"
                      gap={2}
                      flexDir={{ base: 'column', md: 'row' }}
                    >
                      <Flex flex="1" w="100%" minW="0">
                        {' '}
                        {/* Ensure flex item doesn't overflow */}
                        {(() => {
                          // Control type specific rendering for controls
                          switch (row.control_type) {
                            // Text-list (selectable) for control_type 1
                            case 1:
                              return row.textlist_entries ? (
                                <NativeSelect.Root w="100%">
                                  <NativeSelect.Field
                                    value={
                                      row.data !== null &&
                                      row.data !== undefined
                                        ? row.textlist_entries[
                                            row.data.toString()
                                          ] || ''
                                        : ''
                                    }
                                    onChange={(e) =>
                                      handleChange(row.id, e.target.value)
                                    }
                                  >
                                    <option value="">Select an option</option>
                                    {Object.entries(row.textlist_entries).map(
                                      ([value, text]) => (
                                        <option key={value} value={text}>
                                          {text}
                                        </option>
                                      )
                                    )}
                                  </NativeSelect.Field>
                                </NativeSelect.Root>
                              ) : (
                                <Text
                                  w="100%"
                                  wordBreak="break-word"
                                  bg="gray.50"
                                  p={2}
                                  borderRadius="md"
                                  border="1px solid"
                                  borderColor="gray.200"
                                >
                                  No options available
                                </Text>
                              );

                            // Switch (on-off, 0-1) for control_type 146
                            case 146:
                              return (
                                <Flex
                                  alignItems="center"
                                  justifyContent="space-between"
                                  gap={2}
                                  w="100%"
                                >
                                  <Text flex="1" wordBreak="break-word">
                                    {row.data === 1 ? 'ON' : 'OFF'}
                                  </Text>
                                  <Switch.Root
                                    checked={row.data === 1}
                                    onCheckedChange={(details) =>
                                      handleChange(row.id, details.checked)
                                    }
                                  >
                                    <Switch.HiddenInput />
                                    <Switch.Control>
                                      <Switch.Thumb />
                                    </Switch.Control>
                                  </Switch.Root>
                                </Flex>
                              );

                            // Button with 2 states (0-grey, 1-red) for control_type 141
                            case 141:
                              return (
                                <Button
                                  w="100%"
                                  colorScheme={row.data === 1 ? 'red' : 'gray'}
                                  onClick={() => handleStateButtonClick(row.id)}
                                  variant={row.data === 1 ? 'solid' : 'outline'}
                                >
                                  {row.data === 1 ? 'ON' : 'OFF'}
                                </Button>
                              );

                            // Two buttons for control_type 142 (left button = 1, right button = 0)
                            case 142:
                              return (
                                <Flex w="100%" gap={2}>
                                  <Button
                                    flex="1"
                                    colorScheme="blue"
                                    onClick={() =>
                                      handleDualButtonClick(row.id, 1)
                                    }
                                    variant={
                                      row.data === 1 ? 'solid' : 'outline'
                                    }
                                  >
                                    ON (1)
                                  </Button>
                                  <Button
                                    flex="1"
                                    colorScheme="gray"
                                    onClick={() =>
                                      handleDualButtonClick(row.id, 0)
                                    }
                                    variant={
                                      row.data === 0 ? 'solid' : 'outline'
                                    }
                                  >
                                    OFF (0)
                                  </Button>
                                </Flex>
                              );

                            // Switch (on-off, 0-1) for control_type 145
                            case 145:
                              return (
                                <Flex
                                  alignItems="center"
                                  justifyContent="space-between"
                                  gap={2}
                                  w="100%"
                                >
                                  <Text flex="1" wordBreak="break-word">
                                    {row.data === 1 ? 'On' : 'Off'}
                                  </Text>
                                  <Switch.Root
                                    checked={row.data === 1}
                                    onCheckedChange={(details) =>
                                      handleChange(row.id, details.checked)
                                    }
                                  >
                                    <Switch.HiddenInput />
                                    <Switch.Control>
                                      <Switch.Thumb />
                                    </Switch.Control>
                                  </Switch.Root>
                                </Flex>
                              );

                            default:
                              return null;
                          }
                        })()}
                      </Flex>
                      <Flex gap={2} alignItems="center">
                        {row.isModified && (
                          <Icon
                            as={FaUndo}
                            boxSize={4}
                            color="gray.500"
                            cursor="pointer"
                            onClick={() => handleRevert(row.id)}
                            _hover={{ color: 'blue.500' }}
                            alignSelf="flex-start"
                            mt={{ base: 2, md: 0 }}
                          />
                        )}
                        <CommandStatusDisplay
                          status={controlStatus[row.id]?.status || 'idle'}
                          message={controlStatus[row.id]?.message}
                        />
                      </Flex>
                    </Flex>
                  </Field.Root>
                </Card.Body>
              </Card.Root>
            ))}
          </SimpleGrid>
        </Box>
      )}
    </VStack>
  );
};

export default PLCControl;
