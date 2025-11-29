/**
 * Zod Validation Schemas
 *
 * Centralized validation for all data types in the application.
 * Benefits:
 * - Type safety: Auto-generates TypeScript types
 * - Security: Prevents injection attacks and malformed data
 * - Data integrity: Ensures database consistency
 * - Better UX: Clear error messages for users
 * - Single source of truth: Same validation on frontend and backend
 */

import { z } from 'zod';

// ============================================
// COMMON PATTERNS
// ============================================

// Phone number: XXX-XXX-XXXX or (XXX) XXX-XXXX or XXXXXXXXXX
const phoneRegex = /^(\d{3}-\d{3}-\d{4}|\(\d{3}\)\s?\d{3}-\d{4}|\d{10})$/;

// UUID validation
const uuidSchema = z.string().uuid('Invalid ID format');

// Date string validation (YYYY-MM-DD)
const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

// Duration format (MM:SS)
const durationSchema = z.string().regex(/^\d+:\d{2}$/, 'Duration must be in MM:SS format');

// Non-empty string
const nonEmptyString = z.string().min(1, 'This field is required').trim();

// ============================================
// REQUEST SCHEMAS
// ============================================

export const RequestTypeSchema = z.enum(['pricing', 'material', 'support', 'new_builder', 'warranty', 'other'], {
  message: 'Invalid request type',
});

export const RequestStageSchema = z.enum(['new', 'pending', 'completed', 'archived'], {
  message: 'Invalid request stage',
});

export const QuoteStatusSchema = z.enum(['won', 'lost', 'awaiting']).nullable();

export const UrgencySchema = z.enum(['low', 'medium', 'high', 'critical'], {
  message: 'Urgency must be: low, medium, high, or critical',
});

export const SLAStatusSchema = z.enum(['on_track', 'at_risk', 'breached']);

/**
 * Schema for creating a new request
 */
export const CreateRequestSchema = z.object({
  request_type: RequestTypeSchema,
  title: nonEmptyString.max(200, 'Title must be 200 characters or less'),
  description: z.string().max(5000, 'Description must be 5000 characters or less').optional(),

  // Customer information
  customer_name: z.string().max(100, 'Name must be 100 characters or less').optional(),
  customer_address: z.string().max(500, 'Address must be 500 characters or less').optional(),
  customer_phone: z.string().regex(phoneRegex, 'Phone must be in format: XXX-XXX-XXXX').optional().or(z.literal('')),
  customer_email: z.string().email('Invalid email address').optional().or(z.literal('')),

  // Project details
  project_number: z.string().max(100).optional(),
  fence_type: z.string().max(200).optional(),
  linear_feet: z.coerce.number().positive('Linear feet must be positive').max(100000, 'Linear feet seems too high').optional().or(z.literal('')),
  square_footage: z.coerce.number().positive('Square footage must be positive').max(1000000, 'Square footage seems too high').optional().or(z.literal('')),

  // Request specifics
  urgency: UrgencySchema,
  expected_value: z.coerce.number().positive('Expected value must be positive').max(10000000, 'Value seems too high').optional().or(z.literal('')),
  deadline: z.string().optional(),
  special_requirements: z.string().max(5000).optional(),

  // Voice & AI
  voice_recording_url: z.string().url('Invalid URL').optional().or(z.literal('')),
  voice_duration: z.number().positive().max(3600, 'Recording too long (max 1 hour)').optional(),
  transcript: z.string().max(50000).optional(),
  transcript_confidence: z.number().min(0).max(100, 'Confidence must be 0-100').optional(),

  // Photos
  photo_urls: z.array(z.string().url('Invalid photo URL')).max(50, 'Maximum 50 photos').optional(),
}).strict(); // Reject any extra fields

export type CreateRequestInput = z.infer<typeof CreateRequestSchema>;

/**
 * Schema for updating a request (all fields optional)
 */
export const UpdateRequestSchema = CreateRequestSchema.partial().extend({
  id: uuidSchema,
  stage: RequestStageSchema.optional(),
  quote_status: QuoteStatusSchema.optional(),
  assigned_to: uuidSchema.optional(),
  pricing_quote: z.number().positive().optional(),
  internal_notes: z.string().max(10000).optional(),
});

export type UpdateRequestInput = z.infer<typeof UpdateRequestSchema>;

/**
 * Schema for request notes
 */
export const RequestNoteSchema = z.object({
  request_id: uuidSchema,
  note_type: z.enum(['comment', 'internal', 'status_change']),
  content: nonEmptyString.max(10000, 'Note must be 10000 characters or less'),
});

export type RequestNoteInput = z.infer<typeof RequestNoteSchema>;

// ============================================
// SALES COACH / RECORDING SCHEMAS
// ============================================

export const RecordingStatusSchema = z.enum(['uploaded', 'transcribing', 'analyzing', 'completed', 'failed'], {
  message: 'Invalid recording status',
});

/**
 * Schema for transcription data
 * Note: Accepts both number (seconds) and string ("M:SS") for duration
 * to support both API response and display formats
 */
export const TranscriptionSchema = z.object({
  text: z.string().min(1, 'Transcript cannot be empty'),
  duration: z.union([
    z.number().positive('Duration must be positive'),
    z.string().regex(/^\d+:\d{2}$/, 'Duration must be in M:SS format')
  ]),
  confidence: z.number().min(0).max(100, 'Confidence must be between 0-100'),
  speakers: z.array(z.object({
    id: z.string(),
    label: z.string(),
    // Accept either segment count (number) or segment array
    segments: z.union([
      z.number().min(0),
      z.array(z.object({
        start: z.number().min(0),
        end: z.number().min(0),
        text: z.string(),
      }))
    ]).optional(),
  })).optional(),
}); // Removed .strict() to allow additional fields

/**
 * Schema for AI analysis data
 * Flexible to accept various response formats from Claude
 */
export const AnalysisSchema = z.object({
  overallScore: z.number().min(0).max(100, 'Score must be 0-100'),
  processSteps: z.array(z.object({
    name: z.string(),
    completed: z.boolean(),
    score: z.number().min(0).max(100).optional(),
    quality: z.number().min(0).max(100).optional(),
    feedback: z.string().optional(),
    examples: z.array(z.string()).optional(),
    missedOpportunities: z.array(z.string()).optional(),
  })).optional(),
  metrics: z.object({
    engagementScore: z.number().min(0).max(100).optional(),
    clarityScore: z.number().min(0).max(100).optional(),
    objectionHandlingScore: z.number().min(0).max(100).optional(),
    closingScore: z.number().min(0).max(100).optional(),
    paceScore: z.number().min(0).max(100).optional(),
    confidenceScore: z.number().min(0).max(100).optional(),
    // Additional metrics from prompt
    talkListenRatio: z.string().optional(),
    questionsAsked: z.number().optional(),
    objections: z.number().optional(),
    callToActions: z.number().optional(),
    rapportMoments: z.number().optional(),
    valueStatements: z.number().optional(),
  }).optional(),
  strengths: z.array(z.string()).optional(),
  improvements: z.array(z.string()).optional(),
  keyMoments: z.array(z.object({
    // Accept both number and string for timestamp (e.g., "early", "middle", "late")
    timestamp: z.union([z.number().min(0), z.string()]),
    type: z.string(),
    description: z.string(),
    impact: z.string().optional(),
    quote: z.string().optional(),
  })).optional(),
  coachingPriorities: z.array(z.string()).optional(),
  // Accept both string and object for predictedOutcome
  predictedOutcome: z.union([
    z.string(),
    z.object({
      likelihood: z.string(),
      reasoning: z.string(),
      nextSteps: z.string().optional(),
    })
  ]).optional(),
  // Accept both simple enum and complex sentiment object
  sentiment: z.union([
    z.enum(['positive', 'neutral', 'negative', 'mixed']),
    z.object({
      overall: z.enum(['positive', 'neutral', 'negative', 'mixed']).optional(),
      overallScore: z.number().optional(),
      clientSentiment: z.string().optional(),
      repSentiment: z.string().optional(),
      sentimentShift: z.string().optional(),
      emotionalHighs: z.array(z.any()).optional(),
      emotionalLows: z.array(z.any()).optional(),
      empathyMoments: z.array(z.any()).optional(),
    })
  ]).optional(),
}); // Removed .strict() to allow additional fields from AI

/**
 * Schema for creating/updating a recording
 */
export const RecordingSchema = z.object({
  id: uuidSchema.optional(),
  clientName: nonEmptyString.max(200, 'Client name must be 200 characters or less'),
  meetingDate: dateStringSchema,
  duration: durationSchema,
  status: RecordingStatusSchema,
  processType: z.string().max(100).default('standard'),
  uploadedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  transcription: TranscriptionSchema.optional(),
  analysis: AnalysisSchema.optional(),
  error: z.string().max(1000).optional(),
}).strict();

export type RecordingInput = z.infer<typeof RecordingSchema>;

/**
 * Schema for sales process
 */
export const SalesProcessSchema = z.object({
  id: z.string().min(1).max(100),
  name: nonEmptyString.max(200),
  steps: z.array(z.object({
    name: nonEmptyString,
    description: z.string().optional(),
    keyBehaviors: z.array(z.string()).optional(),
  })).min(1, 'Must have at least one step'),
  createdBy: uuidSchema.optional(),
  createdAt: z.string().datetime().optional(),
}).strict();

export type SalesProcessInput = z.infer<typeof SalesProcessSchema>;

/**
 * Schema for knowledge base
 */
export const KnowledgeBaseSchema = z.object({
  companyInfo: z.string().max(5000).optional(),
  products: z.array(z.string().max(200)).max(100, 'Maximum 100 products').optional(),
  commonObjections: z.array(z.string().max(500)).max(50, 'Maximum 50 objections').optional(),
  bestPractices: z.array(z.string().max(500)).max(50, 'Maximum 50 practices').optional(),
  industryContext: z.string().max(5000).optional(),
  lastUpdated: z.string().datetime().optional(),
  updatedBy: uuidSchema.optional(),
}).strict();

export type KnowledgeBaseInput = z.infer<typeof KnowledgeBaseSchema>;

/**
 * Schema for manager review
 */
export const ManagerReviewSchema = z.object({
  reviewerId: uuidSchema,
  reviewerName: nonEmptyString.max(200),
  rating: z.number().int().min(1, 'Rating must be 1-5').max(5, 'Rating must be 1-5'),
  comments: nonEmptyString.max(5000),
  keyTakeaways: z.array(z.string().max(500)).max(20).optional(),
  actionItems: z.array(z.string().max(500)).max(20).optional(),
}).strict();

export type ManagerReviewInput = z.infer<typeof ManagerReviewSchema>;

// ============================================
// USER / PROFILE SCHEMAS
// ============================================

export const UserRoleSchema = z.enum(['sales', 'operations', 'sales-manager', 'admin'], {
  message: 'Invalid user role',
});

/**
 * Schema for user profile
 */
export const UserProfileSchema = z.object({
  full_name: nonEmptyString.max(100, 'Name must be 100 characters or less'),
  email: z.string().email('Invalid email address'),
  phone: z.string().regex(phoneRegex, 'Phone must be in format: XXX-XXX-XXXX').optional().or(z.literal('')),
  role: UserRoleSchema,
  avatar_url: z.string().url('Invalid avatar URL').optional().or(z.literal('')),
  bio: z.string().max(1000, 'Bio must be 1000 characters or less').optional(),
}).strict();

export type UserProfileInput = z.infer<typeof UserProfileSchema>;

/**
 * Schema for updating user profile (all fields optional except email)
 */
export const UpdateUserProfileSchema = UserProfileSchema.partial().extend({
  email: z.string().email('Invalid email address'),
});

export type UpdateUserProfileInput = z.infer<typeof UpdateUserProfileSchema>;

// ============================================
// MESSAGE SCHEMAS
// ============================================

export const MessageTypeSchema = z.enum(['text', 'announcement', 'system']);

/**
 * Schema for direct messages
 */
export const DirectMessageSchema = z.object({
  conversation_id: uuidSchema,
  content: nonEmptyString.max(10000, 'Message must be 10000 characters or less'),
  message_type: MessageTypeSchema,
  metadata: z.record(z.string(), z.any()).optional(),
}).strict();

export type DirectMessageInput = z.infer<typeof DirectMessageSchema>;

/**
 * Schema for creating a conversation
 */
export const CreateConversationSchema = z.object({
  participant_ids: z.array(uuidSchema).min(1, 'Must have at least one participant').max(50, 'Maximum 50 participants'),
  conversation_type: z.enum(['direct', 'group', 'announcement']),
  title: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
}).strict();

export type CreateConversationInput = z.infer<typeof CreateConversationSchema>;

/**
 * Schema for team announcement
 */
export const AnnouncementSchema = z.object({
  title: nonEmptyString.max(200, 'Title must be 200 characters or less'),
  content: nonEmptyString.max(10000, 'Content must be 10000 characters or less'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  target_roles: z.array(UserRoleSchema).optional(),
  expires_at: z.string().datetime().optional(),
}).strict();

export type AnnouncementInput = z.infer<typeof AnnouncementSchema>;

// ============================================
// ASSIGNMENT RULE SCHEMAS
// ============================================

export const AssignmentRuleSchema = z.object({
  request_type: RequestTypeSchema,
  assignee_id: uuidSchema,
  priority: z.number().int().min(1).max(100, 'Priority must be 1-100'),
  is_active: z.boolean().default(true),
}).strict();

export type AssignmentRuleInput = z.infer<typeof AssignmentRuleSchema>;

// ============================================
// SLA SCHEMAS
// ============================================

export const SLADefaultSchema = z.object({
  request_type: RequestTypeSchema,
  target_hours: z.number().positive().max(720, 'Target hours must be less than 720 (30 days)'),
  urgent_target_hours: z.number().positive().max(720).optional(),
  critical_target_hours: z.number().positive().max(720).optional(),
}).strict();

export type SLADefaultInput = z.infer<typeof SLADefaultSchema>;

// ============================================
// PHOTO GALLERY SCHEMAS
// ============================================

export const PhotoTagSchema = z.object({
  tag_name: nonEmptyString.max(100),
  confidence: z.number().min(0).max(100).optional(),
  category: z.string().max(50).optional(),
}).strict();

export const PhotoMetadataSchema = z.object({
  file_name: nonEmptyString.max(255),
  file_size: z.number().positive().max(100000000, 'File too large (max 100MB)'),
  mime_type: z.string().max(100),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  tags: z.array(PhotoTagSchema).max(50).optional(),
  location: z.string().max(500).optional(),
  description: z.string().max(1000).optional(),
}).strict();

export type PhotoMetadataInput = z.infer<typeof PhotoMetadataSchema>;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Validates data and returns either the validated data or validation errors
 */
export function validateData<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error };
    }
    throw error;
  }
}

/**
 * Formats Zod errors into user-friendly messages
 */
export function formatValidationErrors(errors: z.ZodError): Record<string, string> {
  const formatted: Record<string, string> = {};

  errors.issues.forEach((error) => {
    const path = error.path.join('.');
    formatted[path] = error.message;
  });

  return formatted;
}

/**
 * Safe parse with default value
 */
export function parseWithDefault<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  defaultValue: T
): T {
  const result = schema.safeParse(data);
  return result.success ? result.data : defaultValue;
}

/**
 * Validates and throws user-friendly error
 */
export function validateOrThrow<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  fieldLabel?: string
): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.issues[0];
      const field = fieldLabel || firstError.path.join('.');
      throw new Error(`${field}: ${firstError.message}`);
    }
    throw error;
  }
}

// ============================================
// RUNTIME TYPE GUARDS
// ============================================

export function isValidRequestType(value: unknown): value is z.infer<typeof RequestTypeSchema> {
  return RequestTypeSchema.safeParse(value).success;
}

export function isValidUrgency(value: unknown): value is z.infer<typeof UrgencySchema> {
  return UrgencySchema.safeParse(value).success;
}

export function isValidRecordingStatus(value: unknown): value is z.infer<typeof RecordingStatusSchema> {
  return RecordingStatusSchema.safeParse(value).success;
}

export function isValidUserRole(value: unknown): value is z.infer<typeof UserRoleSchema> {
  return UserRoleSchema.safeParse(value).success;
}
