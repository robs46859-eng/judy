import { z } from 'zod';
import { isApprovedVoiceId, isSupportedSpokenLanguage } from '@/lib/voice/catalog';

/** Shared zod schemas for API request-body validation. */

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  email: z.string().trim().toLowerCase().email('A valid email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
});

export const tripCreateSchema = z
  .object({
    name: z.string().trim().max(200).optional(),
    departureDate: z.coerce.date(),
    returnDate: z.coerce.date(),
    destinationName: z.string().trim().min(1, 'destinationName is required').max(200),
    destinationZip: z.string().trim().max(20).optional().nullable(),
    destinationState: z.string().trim().max(100).optional().nullable(),
    destinationCountry: z.string().trim().max(100).optional().nullable(),
    destinationLat: z.coerce.number().min(-90).max(90).optional().nullable(),
    destinationLng: z.coerce.number().min(-180).max(180).optional().nullable(),
    originName: z.string().trim().max(200).optional().nullable(),
    originZip: z.string().trim().max(20).optional().nullable(),
    originState: z.string().trim().max(100).optional().nullable(),
    originCountry: z.string().trim().max(100).optional().nullable(),
    totalBudget: z.coerce.number().min(0).max(100_000_000).optional(),
    airfareCost: z.coerce.number().min(0).max(100_000_000).optional(),
    hotelCost: z.coerce.number().min(0).max(100_000_000).optional(),
    notes: z.string().trim().max(5000).optional().nullable(),
  })
  .refine((data) => data.returnDate >= data.departureDate, {
    message: 'returnDate must be on or after departureDate',
    path: ['returnDate'],
  });

export const itineraryItemSchema = z.object({
  tripId: z.string().min(1, 'tripId is required'),
  date: z.coerce.date().optional(),
  time: z.string().trim().max(50).optional().nullable(),
  title: z.string().trim().min(1, 'title is required').max(300),
  description: z.string().trim().max(2000).optional().nullable(),
  category: z.string().trim().max(50).optional().nullable(),
  location: z.string().trim().max(300).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  lat: z.coerce.number().min(-90).max(90).optional().nullable(),
  lng: z.coerce.number().min(-180).max(180).optional().nullable(),
  cost: z.coerce.number().min(0).max(100_000_000).optional().nullable(),
});

export const contactSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  email: z.string().trim().email('A valid email is required'),
  topic: z.string().trim().max(200).optional().nullable(),
  message: z.string().trim().min(1, 'Message is required').max(5000),
});

export const chatSchema = z.object({
  message: z.string().trim().min(1, 'message is required').max(2000),
  tripContext: z.unknown().optional().nullable(),
  history: z
    .array(
      z
        .object({
          role: z.enum(['user', 'assistant']),
          text: z.string().trim().min(1).max(800),
        })
        .strict()
    )
    .max(8)
    .optional(),
});

export const suggestionsSchema = z.object({
  destination: z.string().trim().min(1, 'destination is required').max(200),
  category: z.string().trim().max(50).optional().nullable(),
  dates: z.string().trim().max(200).optional().nullable(),
  preferences: z.string().trim().max(1000).optional().nullable(),
});

export const avatarSpeakSchema = z.object({
  sessionId: z.string().trim().min(1).max(200),
  text: z.string().trim().min(1).max(2000),
  /** Optional language of the displayed reply; never a provider voice ID. */
  language: z.string().trim().min(1).max(60).optional(),
});

export const avatarStopSchema = z.object({
  sessionId: z.string().trim().min(1).max(200),
});

/** Swarm J7 stage 2 — text to synthesize + Rhubarb-lip-sync for the GLB avatar. */
export const avatarLipsyncSchema = z.object({
  text: z.string().trim().min(1).max(2000),
  language: z.string().trim().min(1).max(20).optional(),
});

/**
 * Conversational onboarding preferences (Swarm J2/J3). `.strict()` so any
 * unlisted key — including anything a model might try to smuggle in — is
 * rejected outright rather than silently ignored or written to Prisma.
 * `completeOnboarding` is a signal, not a timestamp: the server stamps
 * `onboardingCompletedAt` itself, it never trusts a client-supplied date.
 */
export const userPreferencesPatchSchema = z
  .object({
    nativeLanguage: z.string().trim().min(1).max(60).nullable().optional(),
    translationLanguage: z.string().trim().min(1).max(60).nullable().optional(),
    travelRoute: z.string().trim().max(300).nullable().optional(),
    preTravelTasks: z.string().trim().max(1000).nullable().optional(),
    helpPreference: z.string().trim().max(1000).nullable().optional(),
    spokenLanguage: z
      .string()
      .trim()
      .min(1)
      .max(60)
      .refine(isSupportedSpokenLanguage, 'Choose a supported spoken language.')
      .nullable()
      .optional(),
    // Server-approved catalog only (Swarm J5) — never an arbitrary provider ID.
    voiceId: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .refine(isApprovedVoiceId, 'Unknown voice — must be one of the approved catalog entries.')
      .nullable()
      .optional(),
    completeOnboarding: z.boolean().optional(),
  })
  .strict();

/** Formats zod errors into a single human-readable message. */
export function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
    .join('; ');
}
