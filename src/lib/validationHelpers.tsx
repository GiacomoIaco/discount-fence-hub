/**
 * Validation Helper Functions
 *
 * Utilities for integrating Zod validation with user-friendly error handling
 * and toast notifications.
 */

import React, { useState } from 'react';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { formatValidationErrors } from './validation';

/**
 * Validates form data and shows user-friendly toast messages on error
 * @returns The validated data if successful, or null if validation failed
 */
export async function validateWithToast<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  options?: {
    successMessage?: string;
    errorTitle?: string;
  }
): Promise<T | null> {
  try {
    const validated = schema.parse(data);

    if (options?.successMessage) {
      toast.success(options.successMessage);
    }

    return validated;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = formatValidationErrors(error);
      const errorTitle = options?.errorTitle || 'Validation Error';

      // Show first error as toast
      const firstError = Object.values(errors)[0];
      if (firstError) {
        toast.error(`${errorTitle}: ${firstError}`);
      }

      // Log all errors to console for debugging
      console.error('Validation errors:', errors);
    } else {
      toast.error('An unexpected error occurred');
      console.error('Unexpected validation error:', error);
    }

    return null;
  }
}

/**
 * Validates data for form submission and handles errors
 * @returns {valid: boolean, data?: T, errors?: Record<string, string>}
 */
export function validateForm<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { valid: true; data: T } | { valid: false; errors: Record<string, string> } {
  try {
    const validated = schema.parse(data);
    return { valid: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = formatValidationErrors(error);
      return { valid: false, errors };
    }
    return { valid: false, errors: { general: 'Validation failed' } };
  }
}

/**
 * React hook-friendly validation wrapper
 * Use with useState to show errors inline
 */
export function useValidationErrors() {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = <T,>(schema: z.ZodSchema<T>, data: unknown): T | null => {
    const result = validateForm(schema, data);

    if (result.valid) {
      setErrors({});
      return result.data;
    } else {
      setErrors(result.errors);
      return null;
    }
  };

  const clearErrors = () => setErrors({});
  const clearError = (field: string) => {
    setErrors(prev => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  return { errors, validate, clearErrors, clearError };
}

/**
 * Formats a single validation error for display
 */
export function getFieldError(
  errors: Record<string, string>,
  fieldName: string
): string | undefined {
  return errors[fieldName];
}

/**
 * Checks if a field has an error
 */
export function hasFieldError(
  errors: Record<string, string>,
  fieldName: string
): boolean {
  return fieldName in errors;
}

/**
 * Returns all errors as an array of messages
 */
export function getErrorMessages(errors: Record<string, string>): string[] {
  return Object.values(errors);
}

/**
 * Shows all validation errors as separate toasts
 */
export function showValidationErrors(errors: Record<string, string>): void {
  Object.entries(errors).forEach(([field, message]) => {
    toast.error(`${field}: ${message}`, { duration: 4000 });
  });
}

/**
 * Component helper for showing inline error messages
 */
export function ValidationError({ error }: { error?: string }) {
  if (!error) return null;

  return (
    <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
          clipRule="evenodd"
        />
      </svg>
      {error}
    </p>
  );
}

/**
 * Input wrapper with validation error display
 */
interface ValidatedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
}

export function ValidatedInput({ error, label, className = '', ...props }: ValidatedInputProps) {
  const inputClass = `w-full border rounded-lg px-3 py-2 ${
    error
      ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
      : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
  } ${className}`;

  return (
    <div className="mb-4">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <input {...props} className={inputClass} />
      <ValidationError error={error} />
    </div>
  );
}

/**
 * Textarea wrapper with validation error display
 */
interface ValidatedTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
  label?: string;
}

export function ValidatedTextarea({ error, label, className = '', ...props }: ValidatedTextareaProps) {
  const textareaClass = `w-full border rounded-lg px-3 py-2 ${
    error
      ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
      : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
  } ${className}`;

  return (
    <div className="mb-4">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <textarea {...props} className={textareaClass} />
      <ValidationError error={error} />
    </div>
  );
}

/**
 * Select wrapper with validation error display
 */
interface ValidatedSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
  label?: string;
}

export function ValidatedSelect({ error, label, className = '', children, ...props }: ValidatedSelectProps) {
  const selectClass = `w-full border rounded-lg px-3 py-2 ${
    error
      ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
      : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
  } ${className}`;

  return (
    <div className="mb-4">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <select {...props} className={selectClass}>
        {children}
      </select>
      <ValidationError error={error} />
    </div>
  );
}
