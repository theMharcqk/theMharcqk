export const MAX_SUGGEST_BODY = 20_000;

export function isSameOrigin(requestUrl, originHeader) {
  if (!originHeader) return true;
  try {
    return new URL(originHeader).host === new URL(requestUrl).host;
  } catch {
    return false;
  }
}
