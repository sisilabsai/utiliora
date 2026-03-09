export const SITE_NAME = "Utiliora";
export const SITE_ORIGIN = "https://www.utiliora.cloud";

export function absoluteUrl(path = "/"): string {
  return new URL(path, SITE_ORIGIN).toString();
}
