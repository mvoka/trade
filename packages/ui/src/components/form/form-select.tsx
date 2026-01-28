'use client';

import * as React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../select';
import { FormField, FormFieldProps } from './form-field';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface FormSelectProps extends Omit<FormFieldProps, 'children'> {
  /** Select options */
  options: SelectOption[];
  /** Placeholder text */
  placeholder?: string;
  /** Current value */
  value?: string;
  /** Default value */
  defaultValue?: string;
  /** Change handler */
  onValueChange?: (value: string) => void;
  /** Whether the select is disabled */
  disabled?: boolean;
}

/**
 * FormSelect component
 * Select dropdown with label, error, and description support
 */
export function FormSelect({
  label,
  name,
  error,
  description,
  required,
  className,
  options,
  placeholder = 'Select an option',
  value,
  defaultValue,
  onValueChange,
  disabled,
}: FormSelectProps) {
  return (
    <FormField
      label={label}
      name={name}
      error={error}
      description={description}
      required={required}
      className={className}
    >
      <Select
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        disabled={disabled}
        name={name}
        required={required}
      >
        <SelectTrigger
          className={error ? 'border-destructive focus:ring-destructive' : ''}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  );
}

export default FormSelect;
