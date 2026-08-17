export const SESSION_COOKIE_NAME = "brigata_session";

export function generateSessionId(): string {
  return crypto.randomUUID();
}

export function isValidSessionId(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}
