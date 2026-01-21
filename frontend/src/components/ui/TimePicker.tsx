import React, { useState, useRef, useEffect } from "react";
import { Input, Popover, Box, Portal, InputGroup, Button } from "@chakra-ui/react";
import { FaClock } from "react-icons/fa";

interface TimePickerProps {
  value: string; // Format: HH:mm
  onChange: (time: string) => void;
  size?: "xs" | "sm" | "md" | "lg";
  placeholder?: string;
  readOnly?: boolean;
  disabled?: boolean;
  bg?: string;
}

const TimePicker: React.FC<TimePickerProps> = ({
  value,
  onChange,
  size = "md",
  placeholder = "Select time...",
  readOnly = false,
  disabled = false,
 bg,
}) => {
  const [open, setOpen] = useState(false);
  const hourRef = useRef<HTMLDivElement>(null);
  const minuteRef = useRef<HTMLDivElement>(null);

  // Parse time value
  const parseTime = (timeStr: string) => {
    if (!timeStr) return { hours: 0, minutes: 0 };
    
    // Validate format before parsing
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(timeStr)) {
      console.warn(`Invalid time format: ${timeStr}. Expected HH:mm`);
      return { hours: 0, minutes: 0 };
    }
    
    const parts = timeStr.split(":");
    return {
      hours: parseInt(parts[0] || "0", 10),
      minutes: parseInt(parts[1] || "0", 10),
    };
  };

  const { hours, minutes } = parseTime(value);

  // Format display value
  const displayValue = React.useMemo(() => {
    if (!value) return "";
    const { hours, minutes } = parseTime(value);
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }, [value]);

  // Scroll to selected value when opening
  useEffect(() => {
    if (open) {
      const timer = requestAnimationFrame(() => {
        hourRef.current?.querySelector(`[data-value="${hours}"]`)?.scrollIntoView({ 
          block: "center", 
          behavior: "smooth" 
        });
        minuteRef.current?.querySelector(`[data-value="${minutes}"]`)?.scrollIntoView({ 
          block: "center", 
          behavior: "smooth" 
        });
      });
      
      return () => cancelAnimationFrame(timer);
    }
  }, [open, hours, minutes]);

  const handleTimeChange = (type: "hours" | "minutes", val: number) => {
    const current = parseTime(value || "00:00");
    const updated = { ...current, [type]: val };
    
    const timeString = `${String(updated.hours).padStart(2, "0")}:${String(updated.minutes).padStart(2, "0")}`;
    
    onChange(timeString);
  };

  const handleSetNow = () => {
    const now = new Date();
    const timeString = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    onChange(timeString);
    setOpen(false);
  };

  const renderColumn = (
    label: string,
    max: number,
    selected: number,
    onSelect: (val: number) => void,
    ref: React.RefObject<HTMLDivElement | null>
  ) => (
    <Box flex="1" display="flex" flexDirection="column">
      <Box
        px={2}
        py={1}
        fontSize="xs"
        fontWeight="semibold"
        textAlign="center"
        borderBottomWidth="1px"
        bg="gray.50"
      >
        {label}
      </Box>
      <Box
        ref={ref}
        height="200px"
        overflowY="auto"
        css={{
          "&::-webkit-scrollbar": {
            width: "6px",
          },
          "&::-webkit-scrollbar-thumb": {
            background: "#CBD5E0",
            borderRadius: "3px",
          },
          "&::-webkit-scrollbar-track": {
            background: "#F7FAFC",
          },
        }}
      >
        {Array.from({ length: max }, (_, i) => i).map((val) => (
          <Box
            key={val}
            data-value={val}
            px={3}
            py={2}
            textAlign="center"
            cursor="pointer"
            bg={val === selected ? "blue.500" : "transparent"}
            color={val === selected ? "white" : "inherit"}
            _hover={{
              bg: val === selected ? "blue.600" : "gray.100",
            }}
            onClick={() => onSelect(val)}
            fontSize="sm"
          >
            {String(val).padStart(2, "0")}
          </Box>
        ))}
      </Box>
    </Box>
  );

  if (readOnly || disabled) {
    return (
      <Input
        type="text"
        size={size}
        value={displayValue}
        placeholder={placeholder}
        readOnly
        disabled={disabled}
        bg={bg || "gray.100"}
        cursor="not-allowed"
      />
    );
  }

  return (
    <Popover.Root open={open} onOpenChange={(e) => setOpen(e.open)}>
      <Popover.Trigger asChild>
        <Box>
          <InputGroup endElement={<FaClock />}>
            <Input
              type="text"
              value={displayValue}
              placeholder={placeholder}
              onClick={() => setOpen(true)}
              readOnly
              size={size}
              w="130px"
              cursor="pointer"
              bg={bg}
            />
          </InputGroup>
        </Box>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content width="fit-content" zIndex={9999}>
            <Popover.Body p={0}>
              <Box display="flex" borderBottomWidth="1px">
                {renderColumn("Hour", 24, hours, (val) => handleTimeChange("hours", val), hourRef)}
                {renderColumn("Min", 60, minutes, (val) => handleTimeChange("minutes", val), minuteRef)}
              </Box>
              <Box p={2} display="flex" justifyContent="center" gap={2}>
                <Button size="sm" onClick={handleSetNow} variant="outline">
                  Now
                </Button>
                <Button size="sm" onClick={() => setOpen(false)} colorScheme="blue">
                  Done
                </Button>
              </Box>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};

export default TimePicker;
