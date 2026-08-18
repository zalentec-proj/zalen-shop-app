export function isTemporaryBlingImageUrl(value: string | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return false;
  }

  try {
    const url = new URL(trimmed, 'https://storefront.invalid');

    return (
      url.hostname === 'orgbling.s3.amazonaws.com' ||
      url.searchParams.has('Expires') ||
      url.searchParams.has('AWSAccessKeyId') ||
      url.searchParams.has('Signature')
    );
  } catch {
    return false;
  }
}

export function isRenderableCatalogImageUrl(value: string | undefined) {
  return Boolean(value?.trim()) && !isTemporaryBlingImageUrl(value);
}
