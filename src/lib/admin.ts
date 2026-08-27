const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim())
  .filter(Boolean);

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.includes(email);
}

/** For notifying every admin of something (e.g. a pending account signup) — not for auth checks, use isAdminEmail for that. */
export function getAdminEmails(): string[] {
  return ADMIN_EMAILS;
}
