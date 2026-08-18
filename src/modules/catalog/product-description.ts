export type ProductDescriptionBlock =
  | { type: 'heading'; content: string }
  | { type: 'paragraph'; content: string }
  | { type: 'list'; items: string[] };

const htmlEntities: Record<string, string> = {
  amp: '&',
  apos: "'",
  bull: '•',
  copy: '©',
  gt: '>',
  hellip: '…',
  lt: '<',
  mdash: '—',
  nbsp: ' ',
  ndash: '–',
  quot: '"',
  reg: '®',
  trade: '™',
};

function decodeHtmlEntities(value: string) {
  return value.replace(
    /&(#(?:x[0-9a-f]+|\d+)|[a-z]+);/gi,
    (entity, code: string) => {
      if (code.startsWith('#x') || code.startsWith('#X')) {
        const numericValue = Number.parseInt(code.slice(2), 16);
        return Number.isInteger(numericValue) && numericValue >= 0 && numericValue <= 0x10ffff
          ? String.fromCodePoint(numericValue)
          : entity;
      }

      if (code.startsWith('#')) {
        const numericValue = Number.parseInt(code.slice(1), 10);
        return Number.isInteger(numericValue) && numericValue >= 0 && numericValue <= 0x10ffff
          ? String.fromCodePoint(numericValue)
          : entity;
      }

      return htmlEntities[code.toLowerCase()] ?? entity;
    }
  );
}

function stripInlineMarkdown(value: string) {
  return value
    .replace(/!\[([^\]]*)\]\([^\s)]+(?:\s+[^)]*)?\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^\s)]+(?:\s+[^)]*)?\)/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
}

/**
 * Converts the limited HTML/Markdown received from ERPs into safe plain text.
 * The storefront renders this result as React text nodes; raw provider HTML is
 * never inserted into the page.
 */
export function normalizeProductDescription(value: string | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return undefined;
  }

  const text = decodeHtmlEntities(
    trimmed
      .replace(/\r\n?/g, '\n')
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi, '\n\n## $1\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<li\b[^>]*>/gi, '\n• ')
      .replace(/<\/(?:p|div|li|ul|ol|section|article|table|tr)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();

  return text || undefined;
}

export function parseProductDescription(value: string | undefined): ProductDescriptionBlock[] {
  const normalized = normalizeProductDescription(value);

  if (!normalized) {
    return [];
  }

  const blocks: ProductDescriptionBlock[] = [];
  const lines = normalized.split('\n').map((line) => line.trim());
  let paragraphLines: string[] = [];
  let listItems: string[] = [];

  const flushParagraph = () => {
    const content = stripInlineMarkdown(paragraphLines.join(' '));
    if (content) blocks.push({ type: 'paragraph', content });
    paragraphLines = [];
  };
  const flushList = () => {
    const items = listItems.map(stripInlineMarkdown).filter(Boolean);
    if (items.length > 0) blocks.push({ type: 'list', items });
    listItems = [];
  };

  for (const line of lines) {
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const content = stripInlineMarkdown(heading[1]);
      if (content) blocks.push({ type: 'heading', content });
      continue;
    }

    const item = line.match(/^(?:[-*•✓✔]\s+|\d+[.)]\s+)(.+)$/);
    if (item) {
      flushParagraph();
      listItems.push(item[1]);
      continue;
    }

    flushList();
    paragraphLines.push(line);
  }

  flushParagraph();
  flushList();

  return blocks;
}
