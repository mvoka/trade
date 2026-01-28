'use client';

import * as React from 'react';
import { cn } from '../../lib/utils';
import { Label } from '../label';

export interface FormFieldProps {
  /** Field label */
  label?: string;
  /** Field name/id */
  name: string;
  /** Error message to display */
  error?: string;
  /** Helper text/description */
  description?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Additional class names */
  className?: string;
  /** Children (the actual input element) */
  children: React.ReactNode;
}

/**
 * FormField wrapper component
 * Provides consistent layout for label, input, error, and description
 */
export function FormField({
  label,
  name,
  error,
  description,
  required,
  className,
  children,
}: FormFieldProps) {
  const errorId = `${name}-error`;
  const descriptionId = `${name}-description`;

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <Label
          htmlFor={name}
          className={cn(
            'block text-sm font-medium',
            error && 'text-destructive'
          )}
        >
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}

      {/* Clone children to add aria attributes */}
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<any>, {
            id: name,
            name,
            'aria-invalid': error ? 'true' : undefined,
            'aria-describedby': cn(
              error && errorId,
              description && descriptionId
            ) || undefined,
          })
        : children}

      {description && !error && (
        <p
          id={descriptionId}
          className="text-sm text-muted-foreground"
        >
          {description}
        </p>
      )}

      {error && (
        <p
          id={errorId}
          className="text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}

export default FormField;
