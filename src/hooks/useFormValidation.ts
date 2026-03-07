import { useState, useCallback } from "react";
import { z } from "zod";

interface ValidationState {
  errors: Record<string, string>;
  isValid: boolean;
  touched: Record<string, boolean>;
}

/**
 * Hook para validacao de formularios com Zod
 * Pode ser usado com formularios controlados que nao usam react-hook-form
 */
export function useFormValidation<T extends z.ZodTypeAny>(schema: T) {
  const [state, setState] = useState<ValidationState>({
    errors: {},
    isValid: true,
    touched: {},
  });

  const validateField = useCallback(
    (fieldName: string, value: unknown) => {
      // Get the field schema if possible
      const fieldSchema = (schema as any).shape?.[fieldName];
      
      if (!fieldSchema) {
        // Validate the whole object with just this field
        const result = schema.safeParse({ [fieldName]: value });
        if (!result.success) {
          const fieldError = result.error.errors.find(
            (e) => e.path[0] === fieldName
          );
          if (fieldError) {
            setState((prev) => ({
              ...prev,
              errors: { ...prev.errors, [fieldName]: fieldError.message },
              touched: { ...prev.touched, [fieldName]: true },
              isValid: false,
            }));
            return false;
          }
        }
      } else {
        const result = fieldSchema.safeParse(value);
        if (!result.success) {
          setState((prev) => ({
            ...prev,
            errors: { ...prev.errors, [fieldName]: result.error.errors[0]?.message || "Valor invalido" },
            touched: { ...prev.touched, [fieldName]: true },
            isValid: false,
          }));
          return false;
        }
      }

      // Clear error for this field
      setState((prev) => {
        const { [fieldName]: _, ...restErrors } = prev.errors;
        return {
          ...prev,
          errors: restErrors,
          touched: { ...prev.touched, [fieldName]: true },
          isValid: Object.keys(restErrors).length === 0,
        };
      });
      return true;
    },
    [schema]
  );

  const validateAll = useCallback(
    (data: unknown): { success: boolean; data?: z.infer<T>; errors?: Record<string, string> } => {
      const result = schema.safeParse(data);

      if (result.success) {
        setState({
          errors: {},
          isValid: true,
          touched: {},
        });
        return { success: true, data: result.data };
      }

      const errors: Record<string, string> = {};
      const touched: Record<string, boolean> = {};

      result.error.errors.forEach((err) => {
        const path = err.path.join(".");
        if (!errors[path]) {
          errors[path] = err.message;
          touched[path] = true;
        }
      });

      setState({
        errors,
        isValid: false,
        touched,
      });

      return { success: false, errors };
    },
    [schema]
  );

  const setFieldTouched = useCallback((fieldName: string) => {
    setState((prev) => ({
      ...prev,
      touched: { ...prev.touched, [fieldName]: true },
    }));
  }, []);

  const clearErrors = useCallback(() => {
    setState({
      errors: {},
      isValid: true,
      touched: {},
    });
  }, []);

  const getFieldError = useCallback(
    (fieldName: string) => {
      return state.touched[fieldName] ? state.errors[fieldName] : undefined;
    },
    [state.errors, state.touched]
  );

  const hasError = useCallback(
    (fieldName: string) => {
      return Boolean(state.touched[fieldName] && state.errors[fieldName]);
    },
    [state.errors, state.touched]
  );

  return {
    errors: state.errors,
    isValid: state.isValid,
    touched: state.touched,
    validateField,
    validateAll,
    setFieldTouched,
    clearErrors,
    getFieldError,
    hasError,
  };
}

/**
 * Componente de erro inline para campos de formulario
 */
export function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p className="text-sm text-destructive mt-1">{error}</p>
  );
}
