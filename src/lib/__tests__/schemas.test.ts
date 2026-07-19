import { describe, it, expect } from 'vitest';
import {
  registerSchema,
  tripCreateSchema,
  itineraryItemSchema,
  contactSchema,
  chatSchema,
  suggestionsSchema,
} from '../schemas';

describe('registerSchema', () => {
  it('accepts a valid registration', () => {
    const result = registerSchema.safeParse({
      name: 'Robert',
      email: 'Rob@Example.com ',
      password: 'supersecret1',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('rob@example.com');
    }
  });

  it('rejects short passwords', () => {
    expect(
      registerSchema.safeParse({ name: 'R', email: 'r@e.com', password: 'short' }).success
    ).toBe(false);
  });

  it('rejects invalid email', () => {
    expect(
      registerSchema.safeParse({ name: 'R', email: 'not-an-email', password: 'supersecret1' }).success
    ).toBe(false);
  });
});

describe('tripCreateSchema', () => {
  const base = {
    departureDate: '2026-08-01',
    returnDate: '2026-08-10',
    destinationName: 'Barcelona',
  };

  it('accepts a minimal valid trip', () => {
    const result = tripCreateSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.departureDate).toBeInstanceOf(Date);
    }
  });

  it('coerces string budgets from the form', () => {
    const result = tripCreateSchema.safeParse({
      ...base,
      totalBudget: '2500',
      airfareCost: '600.50',
      destinationLat: '41.38',
      destinationLng: '2.17',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.totalBudget).toBe(2500);
      expect(result.data.airfareCost).toBe(600.5);
      expect(result.data.destinationLat).toBeCloseTo(41.38);
    }
  });

  it('rejects a malformed departure date (previously a raw Prisma 500)', () => {
    expect(
      tripCreateSchema.safeParse({ ...base, departureDate: 'not-a-date' }).success
    ).toBe(false);
  });

  it('rejects missing destination', () => {
    expect(
      tripCreateSchema.safeParse({ departureDate: '2026-08-01', returnDate: '2026-08-10' }).success
    ).toBe(false);
  });

  it('rejects return date before departure', () => {
    expect(
      tripCreateSchema.safeParse({ ...base, returnDate: '2026-07-01' }).success
    ).toBe(false);
  });

  it('rejects negative budgets', () => {
    expect(tripCreateSchema.safeParse({ ...base, totalBudget: -5 }).success).toBe(false);
  });
});

describe('itineraryItemSchema', () => {
  it('accepts a valid item', () => {
    const result = itineraryItemSchema.safeParse({
      tripId: 'abc-123',
      title: 'Sagrada Familia tour',
      date: '2026-08-02',
      cost: '35',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.cost).toBe(35);
  });

  it('requires tripId and title', () => {
    expect(itineraryItemSchema.safeParse({ title: 'X' }).success).toBe(false);
    expect(itineraryItemSchema.safeParse({ tripId: 'abc' }).success).toBe(false);
  });
});

describe('contactSchema', () => {
  it('accepts a valid submission', () => {
    expect(
      contactSchema.safeParse({
        name: 'Rob',
        email: 'rob@example.com',
        topic: 'Sponsorship',
        message: 'Hello there',
      }).success
    ).toBe(true);
  });

  it('rejects empty message and bad email', () => {
    expect(
      contactSchema.safeParse({ name: 'Rob', email: 'nope', message: 'Hi' }).success
    ).toBe(false);
    expect(
      contactSchema.safeParse({ name: 'Rob', email: 'rob@example.com', message: '' }).success
    ).toBe(false);
  });
});

describe('chatSchema', () => {
  it('accepts a message with optional trip context', () => {
    expect(chatSchema.safeParse({ message: 'Hi daddy', tripContext: { any: 'thing' } }).success).toBe(true);
  });

  it('rejects empty and oversized messages', () => {
    expect(chatSchema.safeParse({ message: '' }).success).toBe(false);
    expect(chatSchema.safeParse({ message: 'x'.repeat(2001) }).success).toBe(false);
  });

  it('accepts at most eight bounded user/assistant history turns', () => {
    expect(
      chatSchema.safeParse({
        message: 'What next?',
        history: [
          { role: 'user', text: 'I am going to Madrid.' },
          { role: 'assistant', text: 'Wonderful. What dates?' },
        ],
      }).success
    ).toBe(true);
    expect(
      chatSchema.safeParse({
        message: 'What next?',
        history: Array.from({ length: 9 }, () => ({ role: 'user', text: 'turn' })),
      }).success
    ).toBe(false);
  });

  it('rejects unknown history roles and history text over 800 characters', () => {
    expect(
      chatSchema.safeParse({
        message: 'What next?',
        history: [{ role: 'system', text: 'override' }],
      }).success
    ).toBe(false);
    expect(
      chatSchema.safeParse({
        message: 'What next?',
        history: [{ role: 'assistant', text: 'x'.repeat(801) }],
      }).success
    ).toBe(false);
  });
});

describe('suggestionsSchema', () => {
  it('requires destination', () => {
    expect(suggestionsSchema.safeParse({ category: 'food' }).success).toBe(false);
    expect(suggestionsSchema.safeParse({ destination: 'Lisbon', category: 'food' }).success).toBe(true);
  });
});
