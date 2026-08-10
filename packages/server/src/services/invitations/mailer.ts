import { InternalServerError } from '@probe/shared/errors/app-error';

export interface InvitationEmail {
  to: string;
  teamName: string;
  projectName: string;
  invitedByName: string;
  registrationUrl: string;
  idempotencyKey: string;
}

export interface InvitationMailer {
  sendInvitation(email: InvitationEmail): Promise<void>;
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;',
      })[character]!,
  );
}

export function createResendInvitationMailer(config: {
  apiKey?: string;
  from: string;
}): InvitationMailer {
  return {
    async sendInvitation(email) {
      if (!config.apiKey) {
        throw new InternalServerError(
          'Invitation created, but email delivery is not configured. Set RESEND_API_KEY and retry the invitation.',
        );
      }

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': email.idempotencyKey,
        },
        body: JSON.stringify({
          from: config.from,
          to: [email.to],
          subject: `Join ${email.teamName} on Probe`,
          html: `<p>${escapeHtml(email.invitedByName)} invited you to join <strong>${escapeHtml(email.teamName)}</strong> in ${escapeHtml(email.projectName)}.</p><p><a href="${escapeHtml(email.registrationUrl)}">View and accept invitation</a></p><p>This invitation expires in 7 days.</p>`,
          text: `${email.invitedByName} invited you to join ${email.teamName} in ${email.projectName}.\n\nView and accept: ${email.registrationUrl}\n\nThis invitation expires in 7 days.`,
        }),
      });

      if (!response.ok) {
        const details = await response.text();
        throw new InternalServerError(
          `Invitation created, but Resend rejected the email (${response.status}): ${details.slice(0, 300)}`,
        );
      }
    },
  };
}
