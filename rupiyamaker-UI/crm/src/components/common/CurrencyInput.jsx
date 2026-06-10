/**
 * CurrencyInput
 *
 * A text input that always shows Indian comma-formatted numbers.
 * e.g. typing 150000 → displays "1,50,000"
 *
 * Uses type="text" (not type="number") so the browser never shows
 * spinner arrows and always allows formatted display.
 *
 * API is drop-in compatible with a standard <input> — onChange fires
 * a synthetic event with { target: { name, value } } where value is
 * the raw numeric string (no commas), so parent state stays clean.
 */
import React, { useState, useRef, useCallback } from 'react';

/**
 * Format a raw number string to Indian comma notation.
 * "1500000" → "15,00,000"
 */
export const formatIndianCurrency = (raw) => {
  if (raw === null || raw === undefined || raw === '') return '';
  const str = String(raw).replace(/,/g, '').trim();
  if (str === '' || str === '-') return str;

  // Split on decimal point
  const [intPart, decPart] = str.split('.');

  // Apply Indian grouping: last 3 digits, then groups of 2
  const lastThree = intPart.slice(-3);
  const rest = intPart.slice(0, -3);
  const grouped =
    rest.length > 0
      ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree
      : lastThree;

  return decPart !== undefined ? `${grouped}.${decPart}` : grouped;
};

/**
 * Strip all formatting and return the raw numeric string.
 */
const stripFormatting = (str) => String(str || '').replace(/,/g, '');

const CurrencyInput = ({
  name,
  value,
  onChange,
  onBlur,
  onFocus,
  placeholder = '0',
  className = '',
  style = {},
  disabled = false,
  min,
  autoFocus = false,
  ...rest
}) => {
  // Always display formatted; only store raw internally while typing
  const [displayValue, setDisplayValue] = useState(() =>
    value !== '' && value !== null && value !== undefined
      ? formatIndianCurrency(value)
      : ''
  );
  const inputRef = useRef(null);
  const isTyping = useRef(false);

  // Sync from parent value when it changes externally (not while user is typing)
  const prevValue = useRef(value);
  if (!isTyping.current && String(value) !== String(prevValue.current)) {
    prevValue.current = value;
    const formatted = formatIndianCurrency(value);
    setDisplayValue(formatted);
  }

  const handleChange = useCallback(
    (e) => {
      isTyping.current = true;
      const raw = stripFormatting(e.target.value);

      // Only allow digits and at most one decimal point
      if (raw !== '' && !/^\d*\.?\d*$/.test(raw)) return;

      const formatted = formatIndianCurrency(raw);
      setDisplayValue(formatted);

      // Fire parent onChange with raw numeric string
      if (onChange) {
        onChange({ target: { name: name || e.target.name, value: raw } });
      }
    },
    [name, onChange]
  );

  const handleFocus = useCallback(
    (e) => {
      isTyping.current = true;
      onFocus?.(e);
    },
    [onFocus]
  );

  const handleBlur = useCallback(
    (e) => {
      isTyping.current = false;
      prevValue.current = value;
      // Re-format on blur to clean up partial input
      const raw = stripFormatting(displayValue);
      const formatted = formatIndianCurrency(raw);
      setDisplayValue(formatted);
      onBlur?.({ ...e, target: { ...e.target, name: name || e.target.name, value: raw } });
    },
    [displayValue, value, name, onBlur]
  );

  // Handle paste: strip any existing formatting before processing
  const handlePaste = useCallback((e) => {
    e.preventDefault();
    const pasted = (e.clipboardData || window.clipboardData).getData('text');
    const raw = stripFormatting(pasted).replace(/[^\d.]/g, '');
    const formatted = formatIndianCurrency(raw);
    setDisplayValue(formatted);
    if (onChange) {
      onChange({ target: { name, value: raw } });
    }
  }, [name, onChange]);

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      name={name}
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onPaste={handlePaste}
      placeholder={placeholder}
      className={className}
      style={style}
      disabled={disabled}
      autoFocus={autoFocus}
      autoComplete="off"
      {...rest}
    />
  );
};

export default CurrencyInput;
