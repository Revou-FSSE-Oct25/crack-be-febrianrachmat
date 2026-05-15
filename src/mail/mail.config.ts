export function isSmtpConfigured(): boolean {
  const host = process.env.SMTP_HOST?.trim();
  const from = process.env.MAIL_FROM?.trim();
  return Boolean(host && from);
}

export function isEmailVerificationRequired(): boolean {
  if (process.env.EMAIL_VERIFICATION_REQUIRED === 'false') {
    return false;
  }
  if (process.env.EMAIL_VERIFICATION_REQUIRED === 'true') {
    return true;
  }
  // Default: require verification only when SMTP can send mail.
  return isSmtpConfigured();
}

export function resolveFrontendUrl(): string {
  const url = process.env.FRONTEND_URL?.trim();
  if (!url) {
    throw new Error('FRONTEND_URL is not configured.');
  }
  return url.replace(/\/$/, '');
}
