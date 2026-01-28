'use client';

import * as React from 'react';
import { Input } from '../input';
import { FormField, FormFieldProps } from './form-field';

export interface FormInputProps extends Omit<FormFieldProps, 'children'> {
  /** Input type */
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search';
  /** Placeholder text */
  placeholder?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Default value */
  defaultValue?: string;
  /** Controlled value */
  value?: string;
  /** Change handler */
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  /** Blur handler */
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  /** Input size variant */
  size?: 'sm' | 'default' | 'lg';
  /** Left icon */
  leftIcon?: React.ReactNode;
  /** Right icon */
  rightIcon?: React.ReactNode;
  /** Auto complete attribute */
  autoComplete?: string;
  /** ID attribute */
  id?: string;
}

/**
 * FormInput component
 * Input with label, error, and description support
 */
export const FormInput = React.forwardRef<HTMLInputElement, FormInputProps>(
  (
    {
      label,
      name,
      error,
      description,
      required,
      className,
      type = 'text',
      placeholder,
      disabled,
      defaultValue,
      value,
      onChange,
      onBlur,
      size,
      leftIcon,
      rightIcon,
      autoComplete,
      id,
    },
    ref
  ) => {
    const inputId = id || name;

    return (
      <FormField
        label={label}
        name={name}
        error={error}
        description={description}
        required={required}
        className={className}
      >
        <Input
          ref={ref}
          id={inputId}
          name={name}
          type={type}
          placeholder={placeholder}
          disabled={disabled}
          defaultValue={defaultValue}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          size={size}
          leftIcon={leftIcon}
          rightIcon={rightIcon}
          autoComplete={autoComplete}
          error={!!error}
          required={required}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
        />
      </FormField>
    );
  }
);

FormInput.displayName = 'FormInput';

export default FormInput;
