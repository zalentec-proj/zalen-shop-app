const COMPETITOR_NAME_PATTERN = /mundrone/gi;
const COMPETITOR_URL_PATTERN = /https?:\/\/(?:www\.)?mundrone\.com\.br/gi;
const COMPETITOR_DOMAIN_PATTERN = /(?:www\.)?mundrone\.com\.br/gi;

export function containsMundroneReference(value) {
  return /mundrone/i.test(String(value ?? ''));
}

export function sanitizeBrasilDronesDescription(value) {
  if (value === null || value === undefined) return value;

  return String(value)
    .replace(COMPETITOR_URL_PATTERN, 'https://www.brasildroneseparts.com.br')
    .replace(COMPETITOR_DOMAIN_PATTERN, 'www.brasildroneseparts.com.br')
    .replace(COMPETITOR_NAME_PATTERN, 'Brasil Drones & Parts');
}

export function buildDescriptionPatch(product) {
  const patch = {};

  for (const field of ['descricaoCurta', 'descricaoComplementar']) {
    const current = product?.[field];
    if (!containsMundroneReference(current)) continue;

    const sanitized = sanitizeBrasilDronesDescription(current);
    if (sanitized !== current) patch[field] = sanitized;
  }

  return patch;
}

export function countMundroneReferences(value) {
  return String(value ?? '').match(/mundrone/gi)?.length ?? 0;
}
