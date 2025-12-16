// src/components/Dashboard/PLCControl.tsx

import {
  Button,
  Card,
  DataList ,
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
  Slider, // FIX: Import Slider as single namespace
  Box,
} from '@chakra-ui/react';

// --- NEW: Import icons from react-icons ---
import { CgSpinner } from 'react-icons/cg';
import { FaCheckCircle, FaTimesCircle, FaUndo } from 'react-icons/fa';
// --- END NEW ---
import type {
  CommandResponse,
  PlcDataSettingsExtendedRow,
 PlcDataControlExtendedRow,
} from '@/client';
import { toaster } from '@/components/ui/toaster';
import {
  useBulkUpdatePlcDataControl,
  useGetPlcDataControl,
} from '@/hooks/usePlcControlQueries';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

// --- NEW: A small component to display command status with icons ---
const CommandStatusDisplay = ({
  status,
  message,
}: {
  status: 'idle' | 'sending' | 'success' | 'failed';
  message?: string;
}) => {
  if (status === 'idle') {
    return null;
  }

  if (status === 'sending') {
    return (
      <Flex alignItems="center" gap={2} color="blue.500" minW="20px">
        {/* Use CgSpinner inside Chakra's Icon component, and add animation */}
        <Icon
          as={CgSpinner}
          animation="spin 1s linear infinite"
          fontSize="lg"
        />
        <Text fontSize="sm" fontStyle="italic">
          {message || 'Sending...'}
        </Text>
      </Flex>
    );
  }

  if (status === 'success') {
    return (
      <Flex alignItems="center" gap={2} color="green.500" minW="220px">
        <Icon as={FaCheckCircle} fontSize="lg" />
        <Text fontSize="sm" fontWeight="medium">
          {message || 'Success'}
        </Text>
      </Flex>
    );
  }

  if (status === 'failed') {
    return (
      <Flex alignItems="center" gap={2} color="red.500" minW="220px">
        <Icon as={FaTimesCircle} fontSize="lg" />
        <Text fontSize="sm" fontWeight="medium">
          {message || 'Failed'}
        </Text>
      </Flex>
    );
  }

  return null;
};
// --- END NEW COMPONENT ---

interface PLCControlProps {
  tenantId: string | null;
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

const PLCControl = ({ tenantId }: PLCControlProps) => {
  const queryClient = useQueryClient();
  const {
    data: serverData,
    isLoading: loadingControl,
    error,
    dataUpdatedAt,
  } = useGetPlcDataControl({ tenantId });

  const { mutate: bulkUpdatePlcDataControl, isPending: isSaving } =
    useBulkUpdatePlcDataControl({ tenantId });

  const [localData, setLocalData] = useState<ModifiedPlcDataRow[]>([]);

  const [commandStatus, setCommandStatus] = useState<{
    status: 'idle' | 'sending' | 'success' | 'failed';
    message?: string;
  }>({ status: 'idle' });

  const commandTimeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  const commandMessageIdRef = useRef<string | null>(null);

  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);
  const [wsConnected, setWsConnected] = useState<boolean>(false);

  const handleChange = (id: number, value: string | boolean | number) => {
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
          return { ...row, data: newValue, isModified };
        }
        return row;
      });
    });
  };

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
              data.type === 'command_response' &&
              data.message_id === commandMessageIdRef.current
            ) {
              if (commandTimeoutIdRef.current) {
                clearTimeout(commandTimeoutIdRef.current);
                commandTimeoutIdRef.current = null;
              }

              if (data.status === 'ok' || data.status === 'success') {
                setCommandStatus({
                  status: 'success',
                  message: 'Command confirmed',
                });
                // Invalidate the query to refetch the updated data from the server
                queryClient.invalidateQueries({
                  queryKey: ['plcDataControl', { tenantId }],
                });
              } else {
                setCommandStatus({
                  status: 'failed',
                  message: `Command failed: ${data.error || 'Unknown error'}`,
                });
              }

              commandMessageIdRef.current = null;

              setTimeout(() => {
                if (!isUnmounted) {
                  setCommandStatus({ status: 'idle' });
                }
              }, 3000);
            } else if (data.type === 'command_response') {
              console.warn(
                `Ignored command response for old/mismatched message_id: ${data.message_id}`
              );
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
    setLocalData((prev) => {
      return prev.map((row) => {
        if (row.id === id) {
          // Toggle between 0 and 1
          const newValue = row.data === 1 ? 0 : 1;
          const isModified = newValue !== row.originalData;
          return { ...row, data: newValue, isModified };
        }
        return row;
      });
    });
  };

  // Handle button click for control_type 142 (dual buttons)
  const handleDualButtonClick = (id: number, value: number) => {
    setLocalData((prev) => {
      return prev.map((row) => {
        if (row.id === id) {
          const isModified = value !== row.originalData;
          return { ...row, data: value, isModified };
        }
        return row;
      });
    });
  };

  // --- Зберегти зміни ---
  const handleSaveAll = () => {
    if (commandTimeoutIdRef.current) {
      clearTimeout(commandTimeoutIdRef.current);
      commandTimeoutIdRef.current = null;
    }

    setCommandStatus({ status: 'sending', message: 'Sending command...' });

    // Filter to only send modified data
    const modifiedData = localData.filter((row) => row.isModified);
    if (modifiedData.length === 0) {
      setCommandStatus({ status: 'success', message: 'No changes to save' });
      setTimeout(() => setCommandStatus({ status: 'idle' }), 3000);
      return;
    }

    bulkUpdatePlcDataControl(modifiedData, {
      onSuccess: (response: unknown) => {
        // Check if the response has message_id (CommandResponse) or is the data itself
        if (
          response &&
          typeof response === 'object' &&
          'message_id' in response
        ) {
          // This is a CommandResponse
          const commandResponse = response as CommandResponse;
          const messageId = commandResponse.message_id;

          if (messageId) {
            commandMessageIdRef.current = messageId;

            const timeoutId = setTimeout(() => {
              if (commandMessageIdRef.current === messageId) {
                setCommandStatus({
                  status: 'failed',
                  message: 'Command failed (timeout)',
                });
                commandTimeoutIdRef.current = null;
                commandMessageIdRef.current = null;
              }
            }, 10000); // Increased timeout to 10 seconds

            commandTimeoutIdRef.current = timeoutId;

            // --- CHANGE: Set status to 'success' with a waiting message ---
            // This will show the green checkmark and "Command sent...",
            // which will later be replaced by "Command confirmed"
            setCommandStatus({
              status: 'success',
              message: 'Command sent, awaiting confirmation...',
            });
          } else {
            setCommandStatus({
              status: 'success',
              message: 'Changes saved (no msg_id)',
            });
            setTimeout(() => {
              setCommandStatus({ status: 'idle' });
            }, 300);
          }
        } else {
          // If response doesn't have message_id, just show success
          setCommandStatus({ status: 'success', message: 'Changes saved' });
          setTimeout(() => {
            setCommandStatus({ status: 'idle' });
          }, 300);
        }
      },
      onError: (error: Error) => {
        setCommandStatus({
          status: 'failed',
          message: 'Command failed to send',
        });
        setTimeout(() => {
          setCommandStatus({ status: 'idle' });
        }, 30);

        toaster.create({
          title: 'Save Failed',
          description: error.message || 'Could not save command.',
          type: 'error',
        });
      },
    });
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
  const statusData = localData.filter(row =>
    row.control_type === 145 || row.control_type === 2 || row.control_type === 3
  ).sort((a, b) => {
    // Define the hardcoded order: 145, 3, 2
    const order = [145, 3, 2];
    return order.indexOf(a.control_type) - order.indexOf(b.control_type);
  });

  const controlData = localData.filter(row =>
    row.control_type === 1 || row.control_type === 146 || row.control_type === 141 || row.control_type === 142
  );

  return (
    <VStack gap={6} align="stretch">
      {/* 1st block - Statuses (control_type = 145, 2, 3) */}
      {statusData.length > 0 && (
        <Box borderWidth="1px" borderRadius="lg" p={4} bg="gray.50">
          <DataList.Root orientation="horizontal" divideY="1px" maxW="md">
            {statusData.map((row) => (
              <DataList.Item key={row.id} pt="4">
                <DataList.ItemLabel
                  whiteSpace="normal"
                  textOverflow="ellipsis"
                  overflow="hidden"
                  fontSize={{ base: 'xs', sm: 'sm' }}
                >
                  {row.data_text || `Data ${row.data_id}`} (ID: {row.data_id})
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
                            // Switch (on-off, 0-1) for control_type 145
                            case 145:
                              return (
                                <Flex alignItems="center" justifyContent="space-between" gap={2} w="100%">
                                  <Text flex="1" wordBreak="break-word">
                                    {row.data === 1 ? "ON" : "OFF"}
                                  </Text>
                                  <Switch.Root
                                    checked={row.data === 1}
                                    onCheckedChange={(details) => handleChange(row.id, details.checked)}
                                  >
                                    <Switch.HiddenInput />
                                    <Switch.Control>
                                      <Switch.Thumb />
                                    </Switch.Control>
                                  </Switch.Root>
                                </Flex>
                              );

                            // Read-only text for control_type 2 and 3
                            case 2:
                            case 3:
                              return (
                                <Text
                                  w="100%"
                                  wordBreak="break-word"
                                  bg="gray.50"

                                  borderRadius="md"
                                  border="1px solid"
                                  borderColor="gray.200"
                                >
                                  {row.data !== null && row.data !== undefined
                                    ? row.data.toString()
                                    : 'N/A'}
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
          <Heading size="md" mb={4}>Controlling</Heading>
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
                                      row.data !== null && row.data !== undefined
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
                                <Flex alignItems="center" justifyContent="space-between" gap={2} w="100%">
                                  <Text flex="1" wordBreak="break-word">
                                    {row.data === 1 ? "ON" : "OFF"}
                                  </Text>
                                  <Switch.Root
                                    checked={row.data === 1}
                                    onCheckedChange={(details) => handleChange(row.id, details.checked)}
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
                                    onClick={() => handleDualButtonClick(row.id, 1)}
                                    variant={row.data === 1 ? 'solid' : 'outline'}
                                  >
                                    ON (1)
                                  </Button>
                                  <Button
                                    flex="1"
                                    colorScheme="gray"
                                    onClick={() => handleDualButtonClick(row.id, 0)}
                                    variant={row.data === 0 ? 'solid' : 'outline'}
                                  >
                                    OFF (0)
                                  </Button>
                                </Flex>
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
                </Card.Body>
              </Card.Root>
            ))}
          </SimpleGrid>

          {/* Save button */}
          <Flex justify="flex-end" gap={3} alignItems="center" mt={4}>
            <CommandStatusDisplay
              status={commandStatus.status}
              message={commandStatus.message}
            />
            <Button
              colorScheme="blue"
              onClick={handleSaveAll}
              loading={isSaving || commandStatus.status === 'sending'}
              disabled={isSaving || commandStatus.status === 'sending'}
            >
              Зберегти зміни
            </Button>
          </Flex>
        </Box>
      )}
    </VStack>
  );
};

export default PLCControl;
