import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { contactSchema, formatZodError } from '@/lib/schemas';
import { enforceRateLimit } from '@/lib/rate-limit';
import { sendNotificationEmail } from '@/lib/mailer';

/**
 * POST /api/contact
 * Persists contact form submissions and sends an email notification
 * when SMTP is configured.
 */
export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, 'contact', { limit: 5, windowMs: 10 * 60 * 1000 });
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  }

  const { name, email, topic, message } = parsed.data;

  try {
    // Persist first — the DB record is the source of truth.
    const saved = await prisma.contactMessage.create({
      data: { name, email, topic: topic || null, message },
    });

    // Email notification is best-effort.
    try {
      const emailed = await sendNotificationEmail({
        subject: `Judy contact form: ${topic || 'General'} — from ${name}`,
        text: `Name: ${name}\nEmail: ${email}\nTopic: ${topic || 'General'}\n\n${message}\n\nSubmission ID: ${saved.id}`,
        replyTo: email,
      });
      if (!emailed) {
        console.warn('Contact form: SMTP not configured, notification email skipped.');
      }
    } catch (mailError) {
      console.error('Contact form: email notification failed:', mailError);
    }

    return NextResponse.json({
      success: true,
      message: 'Your message has been received. We will get back to you soon!',
    });
  } catch (error) {
    console.error('Contact form error:', error);
    return NextResponse.json({ error: 'Could not save your message.' }, { status: 500 });
  }
}
