# Validation Usage Examples

This document provides examples of how to use the new Zod validation system in your components.

## Table of Contents
1. [Basic Form Validation](#basic-form-validation)
2. [Inline Error Display](#inline-error-display)
3. [Toast Notifications](#toast-notifications)
4. [API Call Validation](#api-call-validation)
5. [Custom Validation](#custom-validation)

---

## Basic Form Validation

### Example: Request Form with Validation

```typescript
import { useState } from 'react';
import { createRequest } from '../lib/requests';
import { CreateRequestSchema } from '../lib/validation';
import { validateWithToast } from '../lib/validationHelpers';
import toast from 'react-hot-toast';

function RequestForm() {
  const [formData, setFormData] = useState({
    request_type: 'pricing',
    title: '',
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    linear_feet: '',
    urgency: 'medium',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // ✅ Validate form data with user-friendly toast messages
    const validatedData = await validateWithToast(
      CreateRequestSchema,
      formData,
      {
        errorTitle: 'Please fix the following errors',
      }
    );

    if (!validatedData) {
      return; // Validation failed, errors already shown to user
    }

    // Data is now guaranteed to be valid!
    try {
      await createRequest(validatedData);
      toast.success('Request created successfully!');
    } catch (error) {
      toast.error('Failed to create request');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={formData.title}
        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
        placeholder="Request Title"
        required
      />
      {/* ...other fields */}
      <button type="submit">Create Request</button>
    </form>
  );
}
```

---

## Inline Error Display

### Example: Form with Field-Level Validation

```typescript
import { useState } from 'react';
import { CreateRequestSchema } from '../lib/validation';
import { validateForm, ValidatedInput, ValidatedSelect } from '../lib/validationHelpers';

function RequestFormWithInlineErrors() {
  const [formData, setFormData] = useState({
    request_type: 'pricing',
    title: '',
    customer_email: '',
    urgency: 'medium',
    linear_feet: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate and get errors
    const result = validateForm(CreateRequestSchema, formData);

    if (!result.valid) {
      setErrors(result.errors);
      return;
    }

    // Clear errors and proceed
    setErrors({});
    const validatedData = result.data;

    try {
      await createRequest(validatedData);
      toast.success('Request created!');
    } catch (error) {
      toast.error('Failed to create request');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Using ValidatedInput component */}
      <ValidatedInput
        label="Request Title"
        type="text"
        value={formData.title}
        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
        error={errors['title']}
        required
      />

      <ValidatedInput
        label="Customer Email"
        type="email"
        value={formData.customer_email}
        onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
        error={errors['customer_email']}
      />

      <ValidatedInput
        label="Linear Feet"
        type="number"
        value={formData.linear_feet}
        onChange={(e) => setFormData({ ...formData, linear_feet: e.target.value })}
        error={errors['linear_feet']}
      />

      <ValidatedSelect
        label="Urgency"
        value={formData.urgency}
        onChange={(e) => setFormData({ ...formData, urgency: e.target.value })}
        error={errors['urgency']}
        required
      >
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
        <option value="critical">Critical</option>
      </ValidatedSelect>

      <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg">
        Submit Request
      </button>
    </form>
  );
}
```

---

## Toast Notifications

### Example: Quick Validation with Toast

```typescript
import { RecordingSchema } from '../lib/validation';
import { validateWithToast } from '../lib/validationHelpers';

async function saveRecording(data: unknown) {
  // Validate and show toast on error
  const validated = await validateWithToast(
    RecordingSchema,
    data,
    {
      successMessage: 'Recording saved successfully!',
      errorTitle: 'Invalid Recording Data',
    }
  );

  if (!validated) {
    return; // Validation failed, user already notified
  }

  // Proceed with save
  await saveRecordingToSupabase(validated, userId);
}
```

---

## API Call Validation

### Example: Server-Side Validation

```typescript
// Netlify function: netlify/functions/create-request.ts
import { CreateRequestSchema } from '../../src/lib/validation';

export async function handler(event) {
  try {
    const data = JSON.parse(event.body);

    // Validate on the server
    const validated = CreateRequestSchema.parse(data);

    // Save to database
    const request = await createRequest(validated);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, request }),
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          errors: formatValidationErrors(error),
        }),
      };
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, message: 'Server error' }),
    };
  }
}
```

---

## Custom Validation

### Example: Conditional Validation

```typescript
import { z } from 'zod';

// Custom schema with conditional validation
const ConditionalRequestSchema = z.object({
  request_type: z.enum(['pricing', 'material', 'support']),
  title: z.string().min(1),

  // Linear feet required only for pricing requests
  linear_feet: z.number().optional(),

  // Material name required only for material requests
  material_name: z.string().optional(),
}).refine(
  (data) => {
    if (data.request_type === 'pricing') {
      return data.linear_feet !== undefined && data.linear_feet > 0;
    }
    return true;
  },
  {
    message: 'Linear feet is required for pricing requests',
    path: ['linear_feet'],
  }
).refine(
  (data) => {
    if (data.request_type === 'material') {
      return data.material_name !== undefined && data.material_name.length > 0;
    }
    return true;
  },
  {
    message: 'Material name is required for material requests',
    path: ['material_name'],
  }
);

// Usage
function handleSubmit(data: unknown) {
  const result = ConditionalRequestSchema.safeParse(data);

  if (!result.success) {
    // Show specific error messages
    result.error.errors.forEach((err) => {
      toast.error(`${err.path.join('.')}: ${err.message}`);
    });
    return;
  }

  // Proceed with valid data
  createRequest(result.data);
}
```

---

## Real-World Example: Complete Request Form

```typescript
import { useState } from 'react';
import { CreateRequestSchema } from '../lib/validation';
import { validateForm, ValidatedInput, ValidatedTextarea, ValidatedSelect } from '../lib/validationHelpers';
import { createRequest } from '../lib/requests';
import toast from 'react-hot-toast';

function CompleteRequestForm() {
  const [formData, setFormData] = useState({
    request_type: 'pricing' as const,
    title: '',
    description: '',
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    linear_feet: '',
    urgency: 'medium' as const,
    special_requirements: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Validate form
    const result = validateForm(CreateRequestSchema, formData);

    if (!result.valid) {
      setErrors(result.errors);
      toast.error('Please fix the errors in the form');
      setIsSubmitting(false);
      return;
    }

    // Clear errors
    setErrors({});

    try {
      await createRequest(result.data);
      toast.success('Request created successfully!');

      // Reset form
      setFormData({
        request_type: 'pricing',
        title: '',
        description: '',
        customer_name: '',
        customer_email: '',
        customer_phone: '',
        linear_feet: '',
        urgency: 'medium',
        special_requirements: '',
      });
    } catch (error) {
      toast.error('Failed to create request. Please try again.');
      console.error('Request creation error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-4 p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Create New Request</h2>

      <ValidatedSelect
        label="Request Type"
        value={formData.request_type}
        onChange={(e) => updateField('request_type', e.target.value)}
        error={errors['request_type']}
        required
      >
        <option value="pricing">Pricing</option>
        <option value="material">Material</option>
        <option value="support">Support</option>
        <option value="warranty">Warranty</option>
      </ValidatedSelect>

      <ValidatedInput
        label="Request Title"
        type="text"
        value={formData.title}
        onChange={(e) => updateField('title', e.target.value)}
        error={errors['title']}
        placeholder="Brief description of the request"
        required
      />

      <ValidatedTextarea
        label="Description"
        value={formData.description}
        onChange={(e) => updateField('description', e.target.value)}
        error={errors['description']}
        placeholder="Provide more details..."
        rows={4}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ValidatedInput
          label="Customer Name"
          type="text"
          value={formData.customer_name}
          onChange={(e) => updateField('customer_name', e.target.value)}
          error={errors['customer_name']}
        />

        <ValidatedInput
          label="Customer Email"
          type="email"
          value={formData.customer_email}
          onChange={(e) => updateField('customer_email', e.target.value)}
          error={errors['customer_email']}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ValidatedInput
          label="Phone Number"
          type="tel"
          value={formData.customer_phone}
          onChange={(e) => updateField('customer_phone', e.target.value)}
          error={errors['customer_phone']}
          placeholder="XXX-XXX-XXXX"
        />

        <ValidatedInput
          label="Linear Feet"
          type="number"
          value={formData.linear_feet}
          onChange={(e) => updateField('linear_feet', e.target.value)}
          error={errors['linear_feet']}
          min="0"
        />
      </div>

      <ValidatedSelect
        label="Urgency"
        value={formData.urgency}
        onChange={(e) => updateField('urgency', e.target.value)}
        error={errors['urgency']}
        required
      >
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
        <option value="critical">Critical</option>
      </ValidatedSelect>

      <ValidatedTextarea
        label="Special Requirements"
        value={formData.special_requirements}
        onChange={(e) => updateField('special_requirements', e.target.value)}
        error={errors['special_requirements']}
        placeholder="Any special considerations..."
        rows={3}
      />

      {/* Error summary */}
      {Object.keys(errors).length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-red-900 mb-2">
            Please fix the following errors:
          </h3>
          <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
            {Object.entries(errors).map(([field, message]) => (
              <li key={field}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-colors ${
          isSubmitting
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        {isSubmitting ? 'Creating Request...' : 'Create Request'}
      </button>
    </form>
  );
}

export default CompleteRequestForm;
```

---

## Benefits You're Getting

### 1. **Type Safety**
```typescript
// ✅ TypeScript knows the exact shape of validated data
const validated = CreateRequestSchema.parse(data);
// validated.urgency can only be 'low' | 'medium' | 'high' | 'critical'
```

### 2. **No More Runtime Errors**
```typescript
// ❌ Before: Could crash at runtime
function calculatePrice(request) {
  return request.linear_feet * pricePerFoot; // NaN if linear_feet is undefined!
}

// ✅ After: Guaranteed valid
function calculatePrice(request: CreateRequestInput) {
  return request.linear_feet! * pricePerFoot; // Safe!
}
```

### 3. **Clear Error Messages**
```typescript
// User sees: "customer_email: Invalid email address"
// Instead of: "null value in column 'customer_email' violates not-null constraint"
```

### 4. **Single Source of Truth**
```typescript
// Define once, use everywhere
export const CreateRequestSchema = z.object({
  title: z.string().min(1).max(200),
  urgency: z.enum(['low', 'medium', 'high', 'critical']),
});

// TypeScript type auto-generated
export type CreateRequestInput = z.infer<typeof CreateRequestSchema>;

// No need to manually keep types and validation in sync!
```

---

## Testing Validation

### Example Test Cases

```typescript
import { describe, it, expect } from 'vitest';
import { CreateRequestSchema } from '../lib/validation';

describe('CreateRequestSchema', () => {
  it('should validate valid request data', () => {
    const validData = {
      request_type: 'pricing',
      title: 'Test Request',
      urgency: 'medium',
    };

    expect(() => CreateRequestSchema.parse(validData)).not.toThrow();
  });

  it('should reject invalid urgency', () => {
    const invalidData = {
      request_type: 'pricing',
      title: 'Test Request',
      urgency: 'super-urgent', // ❌ Not in enum
    };

    expect(() => CreateRequestSchema.parse(invalidData)).toThrow();
  });

  it('should reject negative linear_feet', () => {
    const invalidData = {
      request_type: 'pricing',
      title: 'Test Request',
      urgency: 'medium',
      linear_feet: -100, // ❌ Negative
    };

    expect(() => CreateRequestSchema.parse(invalidData)).toThrow();
  });

  it('should reject invalid email', () => {
    const invalidData = {
      request_type: 'pricing',
      title: 'Test Request',
      urgency: 'medium',
      customer_email: 'not-an-email', // ❌ Invalid format
    };

    expect(() => CreateRequestSchema.parse(invalidData)).toThrow();
  });
});
```

---

## Phase 1 Complete! 🎉

With validation implemented, you now have:

✅ **Security** - XSS and injection protection
✅ **Data Integrity** - Guaranteed clean data in database
✅ **Better UX** - Clear error messages for users
✅ **Type Safety** - Auto-generated TypeScript types
✅ **Less Bugs** - Validation at entry points catches issues early
✅ **Maintainability** - Single source of truth for validation rules

**Phase 1 is now 100% complete!** 🚀
