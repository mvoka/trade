'use client';

import * as React from 'react';
import { cn } from '../../lib/utils';
import { FormField, FormFieldProps } from './form-field';

export interface FormTextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'name'>,
    Omit<FormFieldProps, 'children'> {
  /** Whether to show character count */
  showCount?: boolean;
  /** Maximum character count */
  maxLength?: number;
}

/**
 * FormTextarea component
 * Textarea with label, error, and description support
 */
export const FormTextarea = React.forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  (
    {
      label,
      name,
      error,
      description,
      required,
      className,
      showCount,
      maxLength,
      value,
      defaultValue,
      ...textareaProps
    },
    ref
  ) => {
    const [charCount, setCharCount] = React.useState(
      String(value || defaultValue || '').length
    );

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setCharCount(e.target.value.length);
      textareaProps.onChange?.(e);
    };

    return (
      <FormField
        label={label}
        name={name}
        error={error}
        description={description}
        required={required}
        className={className}
      >
        <div className="relative">
          <textarea
            ref={ref}
            value={value}
            defaultValue={defaultValue}
            maxLength={maxLength}
            required={required}
            className={cn(
              'flex min-h-[80px] w-full rounded-lg border border-input bg-background px-4 py-3 text-sm',
              'placeholder:text-muted-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'resize-y',
              error && 'border-destructive focus-visible:ring-destructive'
            )}
            onChange={handleChange}
            {...textareaProps}
          />
          {showCount && maxLength && (
            <div
              className={cn(
                'absolute bottom-2 right-2 text-xs text-muted-foreground',
                charCount >= maxLength && 'text-destructive'
              )}
            >
              {charCount}/{maxLength}
            </div>
          )}
        </div>
      </FormField>
    );
  }
);

FormTextarea.displayName = 'FormTextarea';

export default FormTextarea;
