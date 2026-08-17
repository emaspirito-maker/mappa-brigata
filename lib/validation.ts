const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MAX_ANSWER_LENGTH = 150;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

export function isNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}
