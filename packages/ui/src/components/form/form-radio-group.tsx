'use client';

import * as React from 'react';
import { cn } from '../../lib/utils';
import { Label } from '../label';
import { FormField, FormFieldProps } from './form-field';

export interface RadioOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface FormRadioGroupProps extends Omit<FormFieldProps, 'children'> {
  /** Radio options */
  options: RadioOption[];
  /** Current value */
  value?: string;
  /** Default value */
  defaultValue?: string;
  /** Change handler */
  onChange?: (value: string) => void;
  /** Layout direction */
  direction?: 'horizontal' | 'vertical';
  /** Whether the group is disabled */
  disabled?: boolean;
}

/**
 * FormRadioGroup component
 * Radio button group with label, error, and description support
 */
export function FormRadioGroup({
  label,
  name,
  error,
  description,
  required,
  className,
  options,
  value,
  defaultValue,
  onChange,
  direction = 'vertical',
  disabled,
}: FormRadioGroupProps) {
  const [selectedValue, setSelectedValue] = React.useState(defaultValue || '');

  const handleChange = (newValue: string) => {
    setSelectedValue(newValue);
    onChange?.(newValue);
  };

  const currentValue = value !== undefined ? value : selectedValue;

  return (
    <FormField
      label={label}
      name={name}
      error={error}
      description={description}
      required={required}
      className={className}
    >
      <div
        role="radiogroup"
        aria-required={required}
        className={cn(
          'space-y-2',
          direction === 'horizontal' && 'flex flex-wrap gap-4 space-y-0'
        )}
      >
        {options.map((option) => {
          const optionId = `${name}-${option.value}`;
          const isChecked = currentValue === option.value;
          const isDisabled = disabled || option.disabled;

          return (
            <div key={option.value} className="flex items-start gap-3">
              <input
                type="radio"
                id={optionId}
                name={name}
                value={option.value}
                checked={isChecked}
                disabled={isDisabled}
                onChange={() => handleChange(option.value)}
                className={cn(
                  'h-4 w-4 mt-0.5 border-input text-primary',
                  'focus:ring-2 focus:ring-ring focus:ring-offset-2',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  error && 'border-destructive'
                )}
                aria-invalid={error ? 'true' : undefined}
              />
              <div className="space-y-0.5">
                <Label
                  htmlFor={optionId}
                  className={cn(
                    'text-sm font-medium cursor-pointer',
                    isDisabled && 'cursor-not-allowed opacity-50',
                    error && 'text-destructive'
                  )}
                >
                  {option.label}
                </Label>
                {option.description && (
                  <p className="text-sm text-muted-foreground">
                    {option.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </FormField>
  );
}

export default FormRadioGroup;
