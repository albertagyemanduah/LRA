import React, { useState, useEffect, useRef } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Select dropdown that reveals a labelled text-entry field when "Other" is
 * chosen. The custom value the user types becomes the stored value, so
 * "Other" selections are always backed by a concrete, validated string.
 *
 * Round-tripping existing records:
 *  - If the stored value is one of the predefined options (excluding "Other"),
 *    that option is shown selected and no text field is rendered.
 *  - If the stored value is non-empty AND not in the predefined list (a
 *    previously-saved custom value), the select shows "Other" selected and
 *    the text field is pre-filled with the custom value.
 *  - If the stored value is empty, the placeholder is shown.
 *
 * Props:
 *  - options: string[] — must include "Other"
 *  - value: string — current stored value
 *  - onChange: (value: string) => void
 *  - placeholder, inputPlaceholder, inputLabel: strings
 *  - allowEmpty: boolean — render a "— Select —" sentinel option (default true)
 *  - required: boolean — show required asterisk on the revealed text label
 *  - className: string
 */
const EMPTY = "_none";

export default function OtherSelect({
  options = [],
  value = "",
  onChange,
  placeholder = "Select…",
  inputPlaceholder = "Please specify…",
  inputLabel = "Specify other",
  allowEmpty = true,
  required = false,
  className = "",
}) {
  const predefined = options.filter((o) => o !== "Other");

  // Track whether the user explicitly chose "Other" this session. Without
  // this, selecting "Other" clears the value to "" and `isOther` evaluates
  // false (because "" is neither "Other" nor a non-empty custom value), so
  // the custom-detail textbox never appears — the bug this fixes.
  const [showOther, setShowOther] = useState(false);

  // Ref flag set synchronously when the user picks "Other". It lets the
  // effect below tell apart "value cleared because Other was just selected"
  // (keep the textbox open) from "value cleared externally" e.g. a cascading
  // parent reset (hide the textbox).
  const selectingOtherRef = useRef(false);

  // A stored value that is non-empty and not in the predefined list is a
  // previously-saved custom value — reveal the textbox and pre-fill it.
  const isCustomValue =
    value !== "" && value !== "Other" && !predefined.includes(value);
  const isOther = showOther || isCustomValue;

  useEffect(() => {
    // When the value is cleared to "" and it was NOT the user selecting
    // "Other" (e.g. a cascading parent reset the field), hide the textbox.
    if (value === "" && !selectingOtherRef.current) {
      setShowOther(false);
    }
    // Consume the flag so a later external clear is correctly detected.
    selectingOtherRef.current = false;
  }, [value]);

  return (
    <div className={className}>
      <Select
        value={isOther ? "Other" : value || EMPTY}
        onValueChange={(v) => {
          if (v === EMPTY) {
            setShowOther(false);
            onChange("");
          } else if (v === "Other") {
            // Reveal the custom-detail textbox immediately and start it empty
            // so the user can type the concrete value.
            selectingOtherRef.current = true;
            setShowOther(true);
            onChange("");
          } else {
            setShowOther(false);
            onChange(v);
          }
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {allowEmpty && <SelectItem value={EMPTY}>— Select —</SelectItem>}
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isOther && (
        <div className="mt-2">
          {inputLabel && (
            <Label className="text-xs text-muted-foreground">
              {inputLabel} {required && <span className="text-destructive">*</span>}
            </Label>
          )}
          <Input
            value={isCustomValue ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={inputPlaceholder}
            className="mt-1"
            aria-label={inputLabel || "Other value"}
          />
        </div>
      )}
    </div>
  );
}
