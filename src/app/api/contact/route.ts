import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/contact
 * Receives contact form submissions from the ContactFormModal.
 * Stores the message and can be extended with email notifications.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, topic, message } = body;

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'Name, email, and message are required' },
        { status: 400 }
      );
    }

    // Log the contact form submission
    console.log('Contact form submission:', {
      name,
      email,
      topic: topic || 'General',
      message,
      timestamp: new Date().toISOString(),
    });

    // TODO: Integrate with SMTP to send email notifications
    // TODO: Persist to database when contact model is added

    return NextResponse.json({
      success: true,
      message: 'Your message has been received. We will get back to you soon!',
    });
  } catch (error: any) {
    console.error('Contact form error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
