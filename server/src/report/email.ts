import type { Config } from '../config';

/**
 * Report email over SMTP (nodemailer). Templated in code, plain text and HTML, the PDF attached. The copy
 * follows the app's rules: no dashes as punctuation, no emojis, "skills" (never "competency").
 */
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments?: Array<{ filename: string; content: Buffer; contentType: string }>;
}

export interface Mailer {
  send(msg: MailMessage): Promise<{ messageId: string }>;
  close(): void;
}

/** SMTP from `SMTP_URL`, or `SMTP_HOST` and friends. Null when neither is set: email is off (501). */
export async function smtpMailer(config: Config): Promise<Mailer | null> {
  if (!config.SMTP_URL && !config.SMTP_HOST) return null;
  const nodemailer = (await import('nodemailer')).default;
  const transport = config.SMTP_URL
    ? nodemailer.createTransport(config.SMTP_URL)
    : nodemailer.createTransport({
        host: config.SMTP_HOST, port: config.SMTP_PORT, secure: config.SMTP_SECURE,
        auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD ?? '' } : undefined
      });
  return {
    async send(msg) {
      const info = await transport.sendMail({ from: config.EMAIL_FROM, replyTo: config.EMAIL_REPLY_TO, ...msg });
      return { messageId: String(info.messageId ?? '') };
    },
    close: () => transport.close()
  };
}

const escape = (s: string) => s.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);

/** The report email: who it is for, which simulation, development or assessment. */
export function reportEmail(input: { name: string | null; storyline: string; purpose: 'development' | 'assessment' }): Omit<MailMessage, 'to' | 'attachments'> {
  const kind = input.purpose === 'assessment' ? 'assessment' : 'development';
  const hello = input.name ? `Hello ${input.name},` : 'Hello,';
  const lines = input.purpose === 'assessment'
    ? [
        `Your iLead assessment report for ${input.storyline} is attached as a PDF.`,
        'It shows how you led your team, the skills you showed in your conversations, and how they compare with the bar for this assessment.',
        'Each finding cites the conversations it rests on, so you can see what it is based on.'
      ]
    : [
        `Your iLead development report for ${input.storyline} is attached as a PDF.`,
        'It shows how you led your team, the skills you showed in your conversations, and what to practice next with your real team.',
        'Pick one thing from your development plan and try it this week.'
      ];
  const footer = 'You can open the simulation again from your learning platform at any time. This message was sent because you asked for your report by email.';
  const text = [hello, '', ...lines.flatMap(l => [l, '']), footer, '', 'The iLead team'].join('\n');
  const html = `<!doctype html><html lang="en"><body style="margin:0;padding:24px;background:#f6f5f2;font-family:Arial,Helvetica,sans-serif;color:#1d1d1f;line-height:1.5">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px">
<p style="margin:0 0 16px;font-size:16px">${escape(hello)}</p>
${lines.map(l => `<p style="margin:0 0 16px;font-size:16px">${escape(l)}</p>`).join('\n')}
<p style="margin:24px 0 0;font-size:13px;color:#5f5f66">${escape(footer)}</p>
<p style="margin:16px 0 0;font-size:14px">The iLead team</p>
</div></body></html>`;
  return { subject: `Your iLead ${kind} report`, text, html };
}
