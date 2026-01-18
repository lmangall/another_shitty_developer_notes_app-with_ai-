import { Resend } from 'resend';

let resend: Resend | null = null;

function getResend(): Resend {
  if (!resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

export async function sendReminderEmail(to: string, message: string) {
  const domain = process.env.EMAIL_DOMAIN;

  return getResend().emails.send({
    from: `Notes App <reminders@${domain}>`,
    to,
    subject: 'Reminder',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Reminder</h2>
        <p style="font-size: 16px; line-height: 1.6;">${message}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #666; font-size: 12px;">
          This reminder was sent from your Notes App.
        </p>
      </div>
    `,
  });
}

export async function sendConfirmationEmail(to: string, action: string, details: string) {
  const domain = process.env.EMAIL_DOMAIN;

  return getResend().emails.send({
    from: `Notes App <noreply@${domain}>`,
    to,
    subject: action,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${action}</h2>
        <p style="font-size: 16px; line-height: 1.6;">${details}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #666; font-size: 12px;">
          Sent from your Notes App.
        </p>
      </div>
    `,
  });
}
