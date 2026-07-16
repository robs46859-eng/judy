import { z } from 'zod';

export const HERMES_TRANSLATION_INPUT_MAX_CHARS = 5_965;
export const HERMES_KNOWLEDGE_PROMPT_MAX_CHARS = 4_000;
export const HERMES_KNOWLEDGE_CONTEXT_CHUNK_MAX_CHARS = 20_000;
export const HERMES_KNOWLEDGE_CONTEXT_TOTAL_MAX_CHARS = 80_000;
export const HERMES_LANGUAGE_MAX_CHARS = 64;
export const HERMES_TRANSLATION_INPUT_MAX_BYTES = 6_000;
export const HERMES_KNOWLEDGE_INPUT_MAX_BYTES = 8_000;
export const HERMES_TRANSLATION_CONTEXT = 'Judy travel application translation';

const utf8Size = (...values: string[]) =>
  values.reduce((total, value) => total + new TextEncoder().encode(value).length, 0);

const languageSchema = z.string().trim().min(1).max(HERMES_LANGUAGE_MAX_CHARS);
const translationInputSchema = z
  .string()
  .min(1)
  .max(HERMES_TRANSLATION_INPUT_MAX_CHARS)
  .refine((value) => value.trim().length > 0, 'Input must contain non-whitespace text.');
const knowledgePromptSchema = z
  .string()
  .min(1)
  .max(HERMES_KNOWLEDGE_PROMPT_MAX_CHARS)
  .refine((value) => value.trim().length > 0, 'Prompt must contain non-whitespace text.');

export const hermesTranslationSchema = z
  .object({
    input: translationInputSchema,
    source_language: languageSchema.optional(),
    target_language: languageSchema,
  })
  .strict()
  .refine(
    // Budget covers the input plus the fixed relay context the client adds,
    // matching the worker's total input budget.
    (value) =>
      utf8Size(value.input, HERMES_TRANSLATION_CONTEXT) <= HERMES_TRANSLATION_INPUT_MAX_BYTES,
    {
      message: 'Translation input exceeds the model budget.',
      path: ['input'],
    }
  );

export const hermesKnowledgeSchema = z
  .object({
    prompt: knowledgePromptSchema,
    context_chunks: z
      .array(
        z
          .string()
          .min(1)
          .max(HERMES_KNOWLEDGE_CONTEXT_CHUNK_MAX_CHARS)
          .refine((value) => value.trim().length > 0, 'Context must contain non-whitespace text.')
      )
      .min(1)
      .max(64),
  })
  .strict()
  .refine(
    (value) =>
      value.context_chunks.reduce((total, chunk) => total + chunk.length, 0) <=
      HERMES_KNOWLEDGE_CONTEXT_TOTAL_MAX_CHARS,
    { message: 'Knowledge context exceeds the total size limit.', path: ['context_chunks'] }
  )
  .refine(
    (value) => utf8Size(value.prompt, ...value.context_chunks) <= HERMES_KNOWLEDGE_INPUT_MAX_BYTES,
    { message: 'Knowledge input exceeds the model budget.', path: ['context_chunks'] }
  );

export const hermesPayloadSchemas = {
  translate: hermesTranslationSchema,
  knowledge: hermesKnowledgeSchema,
} as const;

export type HermesJobType = keyof typeof hermesPayloadSchemas;
export type HermesTranslationPayload = z.infer<typeof hermesTranslationSchema>;
export type HermesKnowledgePayload = z.infer<typeof hermesKnowledgeSchema>;
export type HermesPayload = HermesTranslationPayload | HermesKnowledgePayload;
export type HermesPayloadByType = {
  translate: HermesTranslationPayload;
  knowledge: HermesKnowledgePayload;
};

export type HermesJsonValue =
  | string
  | number
  | boolean
  | null
  | HermesJsonValue[]
  | { [key: string]: HermesJsonValue };

export const hermesJsonValueSchema: z.ZodType<HermesJsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(hermesJsonValueSchema).max(256),
    z.record(z.string().max(200), hermesJsonValueSchema),
  ])
);

export const upstreamHermesStatusSchema = z.enum([
  'accepted',
  'queued',
  'pending',
  'leased',
  'claimed',
  'running',
  'processing',
  'in_progress',
  'success',
  'succeeded',
  'complete',
  'completed',
  'error',
  'failed',
]);

export type UpstreamHermesStatus = z.infer<typeof upstreamHermesStatusSchema>;
export type HermesJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export function normalizeHermesStatus(status: UpstreamHermesStatus): HermesJobStatus {
  switch (status) {
    case 'accepted':
    case 'queued':
    case 'pending':
      return 'queued';
    case 'claimed':
    case 'leased':
    case 'running':
    case 'processing':
    case 'in_progress':
      return 'running';
    case 'success':
    case 'succeeded':
    case 'complete':
    case 'completed':
      return 'succeeded';
    case 'error':
    case 'failed':
      return 'failed';
  }
}

const bridgeJobIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);

export const hermesCreateResponseSchema = z
  .object({
    job_id: bridgeJobIdSchema,
    status: upstreamHermesStatusSchema,
  })
  .strict();

export const hermesStatusResponseSchema = z
  .object({
    status: upstreamHermesStatusSchema,
    result: hermesJsonValueSchema.nullish(),
    error: z.string().max(2_000).nullish(),
  })
  .strict();

export type HermesCreateResponse = z.infer<typeof hermesCreateResponseSchema>;
export type HermesStatusResponse = z.infer<typeof hermesStatusResponseSchema>;
