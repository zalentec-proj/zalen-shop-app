type DevLogDetails = Record<string, string | number | boolean | null | undefined>;

const loggedMessages = new Set<string>();

function formatDetails(details?: DevLogDetails): string {
  if (!details) {
    return '';
  }

  const text = Object.entries(details)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(' ');

  return text ? ` (${text})` : '';
}

export function logDevOnce(
  scope: string,
  message: string,
  details?: DevLogDetails
) {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  const detailText = formatDetails(details);
  const logKey = `${scope}:${message}:${detailText}`;

  if (loggedMessages.has(logKey)) {
    return;
  }

  loggedMessages.add(logKey);
  console.info(`[${scope}] ${message}${detailText}`);
}
