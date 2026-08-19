import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
  /** `sm` matches the ribbon's control row; `default` is the standalone size. */
  size?: "sm" | "default";
}

export function Select({
  value,
  onValueChange,
  options,
  placeholder = "Select...",
  className,
  disabled = false,
  size = "default",
  "aria-label": ariaLabel,
}: SelectProps) {
  return (
    <div className={cn("relative inline-block", className)}>
      <select
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        disabled={disabled}
        aria-label={ariaLabel}
        className={cn(
          "w-full appearance-none rounded-md border border-input bg-background pr-8",
          size === "sm" ? "h-7 px-2 text-xs" : "h-8 px-3 text-sm",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "cursor-pointer",
        )}
      >
        {placeholder && !value && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className={cn(
          "pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground",
          size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4",
        )}
      />
    </div>
  );
}

export default Select;
