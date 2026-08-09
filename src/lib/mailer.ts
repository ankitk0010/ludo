import nodemailer from 'nodemailer';

/*
 * SMTP mailer used for password resets (and any transactional email later).
 * Configure via environment variables:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 * Gmail example (App Password):
 *   SMTP_HOST=smtp.gmail.com  SMTP_PORT=587  SMTP_USER=<you>@gmail.com
 */

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || 'Ludo Master <no-reply@ludomaster.app>';

export const mailEnabled = Boolean(SMTP_USER && SMTP_PASS);

const transport = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
});

export function appBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl) return envUrl.replace(/\/+$/, '');
  return 'http://localhost:3000';
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<boolean> {
  if (!mailEnabled) {
    console.warn('[mailer] SMTP not configured — skipping reset email to', to, 'link:', resetUrl);
    return false;
  }

  await transport.sendMail({
    from: SMTP_FROM,
    to,
    subject: '🔐 Ludo Master — Reset your password',
    text: [
      'Hello!',
      '',
      'We received a request to reset the password for your Ludo Master account.',
      '',
      'Open the link below within 30 minutes to choose a new password:',
      resetUrl,
      '',
      'If you did not ask to reset your password, you can safely ignore this email.',
      '',
      '— The Ludo Master team',
    ].join('\n'),
    html: `
      <div style="font-family:'Plus Jakarta Sans',Segoe UI,Arial,sans-serif;background:#0b1020;padding:28px 16px;color:#e2e8f0;">
        <div style="max-width:420px;margin:0 auto;background:#151b2e;border:1px solid #2a3450;border-radius:20px;padding:28px;text-align:center;">
          <div style="font-size:40px;">🎲</div>
          <h1 style="font-size:20px;margin:12px 0 4px;color:#ffffff;">Reset your password</h1>
          <p style="font-size:13px;color:#94a3b8;line-height:1.6;">
            We received a request to reset the password for your
            <strong style="color:#c4b5fd;">Ludo Master</strong> account.
          </p>
          <a href="${resetUrl}"
             style="display:inline-block;margin:18px 0 6px;padding:13px 26px;border-radius:14px;
                    background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#ffffff;font-weight:800;
                    font-size:14px;text-decoration:none;">
            Choose a new password
          </a>
          <p style="font-size:11px;color:#64748b;margin-top:10px;">
            This link expires in 30 minutes. If you did not request this, ignore this email.
          </p>
          <p style="font-size:10px;color:#475569;margin-top:14px;">— The Ludo Master team</p>
        </div>
      </div>
    `,
  });

  return true;
}
