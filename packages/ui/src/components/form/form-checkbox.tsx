'use client';

import * as React from 'react';
import { cn } from '../../lib/utils';
import { Label } from '../label';

export interface FormCheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Checkbox label */
  label: string;
  /** Error message */
  error?: string;
  /** Description text */
  description?: string;
}

/**
 * FormCheckbox component
 * Checkbox with label and error support
 */
export const FormCheckbox = React.forwardRef<HTMLInputElement, FormCheckboxProps>(
  ({ label, name, error, description, className, id, ...props }, ref) => {
    const inputId = id || name;

    return (
      <div className={cn('space-y-1', className)}>
        <div className="flex items-start gap-3">
          <input
            ref={ref}
            type="checkbox"
            id={inputId}
            name={name}
            className={cn(
              'h-4 w-4 mt-0.5 rounded border-input text-primary',
              'focus:ring-2 focus:ring-ring focus:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50',
              error && 'border-destructive'
            )}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? `${inputId}-error` : undefined}
            {...props}
          />
          <div className="space-y-1">
            <Label
              htmlFor={inputId}
              className={cn(
                'text-sm font-medium cursor-pointer',
                error && 'text-destructive'
              )}
            >
              {label}
            </Label>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        {error && (
          <p
            id={`${inputId}-error`}
            className="text-sm text-destructive ml-7"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    );
  }
);

FormCheckbox.displayName = 'FormCheckbox';

export default FormCheckbox;
