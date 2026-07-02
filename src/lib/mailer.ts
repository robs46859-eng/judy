import nodemailer from 'nodemailer';

/**
 * Sends a notification email if SMTP is configured.
 * Missing SMTP config is not an error — email is best-effort; the
 * database record is the source of truth for contact submissions.
 */
export async function sendNotificationEmail(options: {
  subject: string;
  text: string;
  replyTo?: string;
}): Promise<boolean> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, ADMIN_EMAIL } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !ADMIN_EMAIL) {
    return false;
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  await transporter.sendMail({
    from: `"Judy App" <${SMTP_USER}>`,
    to: ADMIN_EMAIL,
    subject: options.subject,
    text: options.text,
    replyTo: options.replyTo,
  });

  return true;
}
