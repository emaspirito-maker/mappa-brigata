export const PRESENTER_COOKIE_NAME = "brigata_presenter";

export function checkPin(input: string, expected: string): boolean {
  return input.trim() === expected;
}
