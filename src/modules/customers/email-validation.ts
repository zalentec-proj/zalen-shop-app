const commonDomainCorrections = new Map<string, string>([
  ['gmail.coim', 'gmail.com'],
  ['gmai.com', 'gmail.com'],
  ['gmal.com', 'gmail.com'],
  ['gamil.com', 'gmail.com'],
  ['gmial.com', 'gmail.com'],
  ['gmail.con', 'gmail.com'],
  ['gmail.com.br', 'gmail.com'],
  ['hotmial.com', 'hotmail.com'],
  ['hotmai.com', 'hotmail.com'],
  ['hotmail.con', 'hotmail.com'],
  ['outlok.com', 'outlook.com'],
  ['outloo.com', 'outlook.com'],
  ['outlook.con', 'outlook.com'],
  ['yaho.com', 'yahoo.com'],
  ['yahoo.con', 'yahoo.com'],
  ['icloud.con', 'icloud.com'],
]);

export function normalizeEmailAddress(email: string) {
  return email.trim().toLowerCase();
}

export function getCommonEmailTypoSuggestion(email: string) {
  const normalizedEmail = normalizeEmailAddress(email);
  const atIndex = normalizedEmail.lastIndexOf('@');

  if (atIndex <= 0 || atIndex === normalizedEmail.length - 1) {
    return null;
  }

  const localPart = normalizedEmail.slice(0, atIndex);
  const domain = normalizedEmail.slice(atIndex + 1);
  const correctedDomain = commonDomainCorrections.get(domain);

  return correctedDomain ? `${localPart}@${correctedDomain}` : null;
}

export function getEmailTypoErrorMessage(email: string) {
  const suggestion = getCommonEmailTypoSuggestion(email);

  return suggestion
    ? `Revise o e-mail. Talvez seja ${suggestion}.`
    : null;
}
