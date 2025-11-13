import React, { useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { Input, Popover, Box, Portal, Icon, InputGroup } from "@chakra-ui/react";
import { FaCalendarAlt } from "react-icons/fa";
import { format, parseISO, isValid } from "date-fns";
import { Button } from "@/components/ui/button";

interface DatePickerProps {
  value: string; // Format: YYYY-MM-DD
  onChange: (date: string) => void;
  size?: "xs" | "sm" | "md" | "lg";
  placeholder?: string;
}

// Map size to calendar scale
const sizeStyles = {
  xs: { fontSize: "0.75rem", padding: "0.25rem" },
  sm: { fontSize: "0.875rem", padding: "0.5rem" },
  md: { fontSize: "1rem", padding: "0.75rem" },
  lg: { fontSize: "1.125rem", padding: "1rem" },
};

const DatePicker: React.FC<DatePickerProps> = ({ value, onChange, size = "md", placeholder = "Select date..." }) => {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState<Date>(() => {
    // Initialize with selected date or today
    if (value) {
      try {
        const parsed = parseISO(value);
        return isValid(parsed) ? parsed : new Date();
      } catch {
        return new Date();
      }
    }
    return new Date();
  });

  // Safely parse the date
  const selectedDate = React.useMemo(() => {
    if (!value) return undefined;
    try {
      const parsed = parseISO(value);
      return isValid(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }, [value]);

  // Format display value
  const displayValue = React.useMemo(() => {
    if (!selectedDate) return "";
    return format(selectedDate, "dd.MM.yyyy");
  }, [selectedDate]);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      const dateString = format(date, "yyyy-MM-dd");
      onChange(dateString);
    }
    setOpen(false);
  };

  const handleGoToToday = () => {
    const today = new Date();
    setMonth(today);
    const dateString = format(today, "yyyy-MM-dd");
    onChange(dateString);
    setOpen(false);
  };

  const calendarStyle = sizeStyles[size];

  return (
    <Popover.Root open={open} onOpenChange={(e) => setOpen(e.open)}>
      <Popover.Trigger asChild>
        <Box>
          <InputGroup endElement={<FaCalendarAlt />}>
            <Input type="text" value={displayValue} placeholder={placeholder} onClick={() => setOpen(true)} readOnly size={size} w="130px" cursor="pointer" />
            {/* <Icon size="lg" color="tomato">
              <FaCalendarAlt />
            </Icon> */}
          </InputGroup>
        </Box>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content width="fit-content" zIndex={9999}>
            <Popover.Body p={0}>
              <Box
                style={{
                  fontSize: calendarStyle.fontSize,
                  padding: calendarStyle.padding,
                }}
                css={{
                  "& .rdp-months": {
                    fontSize: calendarStyle.fontSize,
                  },
                  "& .rdp-day": {
                    fontSize: calendarStyle.fontSize,
                  },
                  "& .rdp-caption": {
                    fontSize: calendarStyle.fontSize,
                  },
                  "& .rdp-button": {
                    fontSize: calendarStyle.fontSize,
                  },
                }}>
                <DayPicker mode="single" selected={selectedDate} onSelect={handleDateSelect} month={month} onMonthChange={setMonth} initialFocus={open} />
                <Box p={2} borderTopWidth="1px" display="flex" justifyContent="center">
                  <Button size="sm" onClick={handleGoToToday} variant="outline">
                    Today
                  </Button>
                </Box>
              </Box>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};

export default DatePicker;
