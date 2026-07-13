import type { DroneModelDetection } from './drone-model.types';

export interface DroneModelDefinition {
  lineSlug: string;
  name: string;
  slug: string;
  aliases: string[];
  position: number;
}

export const droneModelLineDefinitions = [
  { name: 'Linha Lito', slug: 'lito', position: 10 },
  { name: 'Flip', slug: 'flip', position: 20 },
  { name: 'Linha Neo', slug: 'neo', position: 30 },
  { name: 'Linha Mini', slug: 'mini', position: 40 },
  { name: 'Linha Air', slug: 'air', position: 50 },
  { name: 'Linha Avata', slug: 'avata', position: 60 },
  { name: 'Linha Mavic', slug: 'mavic', position: 70 },
  { name: 'Linha Phantom', slug: 'phantom', position: 80 },
] as const;

export const droneModelDefinitions: DroneModelDefinition[] = [
  { lineSlug: 'lito', name: 'Lito', slug: 'lito', aliases: ['lito', 'dji lito'], position: 10 },
  { lineSlug: 'lito', name: 'Lito X1', slug: 'lito-x1', aliases: ['lito x1', 'dji lito x1'], position: 20 },
  { lineSlug: 'flip', name: 'Flip', slug: 'flip', aliases: ['flip', 'dji flip'], position: 10 },
  { lineSlug: 'neo', name: 'Neo', slug: 'neo', aliases: ['neo', 'dji neo'], position: 10 },
  { lineSlug: 'neo', name: 'Neo 2', slug: 'neo-2', aliases: ['neo 2', 'dji neo 2'], position: 20 },
  { lineSlug: 'mini', name: 'Mini', slug: 'mini', aliases: ['mini', 'dji mini'], position: 10 },
  { lineSlug: 'mini', name: 'Mini 2', slug: 'mini-2', aliases: ['mini 2', 'dji mini 2'], position: 20 },
  { lineSlug: 'mini', name: 'Mini 2 SE', slug: 'mini-2-se', aliases: ['mini 2 se', 'mini 2se', 'dji mini 2 se'], position: 30 },
  { lineSlug: 'mini', name: 'Mini 4K', slug: 'mini-4k', aliases: ['mini 4k', 'dji mini 4k'], position: 40 },
  { lineSlug: 'mini', name: 'Mini 3', slug: 'mini-3', aliases: ['mini 3', 'dji mini 3'], position: 50 },
  { lineSlug: 'mini', name: 'Mini 3 Pro', slug: 'mini-3-pro', aliases: ['mini 3 pro', 'dji mini 3 pro'], position: 60 },
  { lineSlug: 'mini', name: 'Mini 4 Pro', slug: 'mini-4-pro', aliases: ['mini 4 pro', 'dji mini 4 pro'], position: 70 },
  { lineSlug: 'mini', name: 'Mini 5 Pro', slug: 'mini-5-pro', aliases: ['mini 5 pro', 'dji mini 5 pro'], position: 80 },
  { lineSlug: 'air', name: 'Air', slug: 'air', aliases: ['air', 'dji air'], position: 10 },
  { lineSlug: 'air', name: 'Air 2S', slug: 'air-2s', aliases: ['air 2s', 'dji air 2s'], position: 20 },
  { lineSlug: 'air', name: 'Air 2', slug: 'air-2', aliases: ['air 2', 'dji air 2'], position: 30 },
  { lineSlug: 'air', name: 'Air 3', slug: 'air-3', aliases: ['air 3', 'dji air 3'], position: 40 },
  { lineSlug: 'air', name: 'Air 3S', slug: 'air-3s', aliases: ['air 3s', 'dji air 3s'], position: 50 },
  { lineSlug: 'avata', name: 'Avata', slug: 'avata', aliases: ['avata', 'dji avata'], position: 10 },
  { lineSlug: 'avata', name: 'Avata 2', slug: 'avata-2', aliases: ['avata 2', 'avata 02', 'dji avata 2'], position: 20 },
  { lineSlug: 'avata', name: 'Avata 360', slug: 'avata-360', aliases: ['avata 360', 'dji avata 360'], position: 30 },
  { lineSlug: 'mavic', name: 'Mavic Pro', slug: 'mavic-pro', aliases: ['mavic pro', 'dji mavic pro'], position: 10 },
  { lineSlug: 'mavic', name: 'Mavic 2 Pro', slug: 'mavic-2-pro', aliases: ['mavic 2 pro', 'dji mavic 2 pro'], position: 20 },
  { lineSlug: 'mavic', name: 'Mavic 2 Zoom', slug: 'mavic-2-zoom', aliases: ['mavic 2 zoom', 'dji mavic 2 zoom'], position: 30 },
  { lineSlug: 'mavic', name: 'Mavic 3', slug: 'mavic-3', aliases: ['mavic 3', 'dji mavic 3'], position: 40 },
  { lineSlug: 'mavic', name: 'Mavic 3 Classic', slug: 'mavic-3-classic', aliases: ['mavic 3 classic', 'dji mavic 3 classic'], position: 50 },
  { lineSlug: 'mavic', name: 'Mavic 3 Pro', slug: 'mavic-3-pro', aliases: ['mavic 3 pro', 'dji mavic 3 pro'], position: 60 },
  { lineSlug: 'mavic', name: 'Mavic 3 Cine', slug: 'mavic-3-cine', aliases: ['mavic 3 cine', 'dji mavic 3 cine'], position: 70 },
  { lineSlug: 'mavic', name: 'Mavic 4 Pro', slug: 'mavic-4-pro', aliases: ['mavic 4 pro', 'dji mavic 4 pro'], position: 80 },
  { lineSlug: 'phantom', name: 'Phantom 4 Pro', slug: 'phantom-4-pro', aliases: ['phantom 4 pro', 'dji phantom 4 pro'], position: 10 },
  { lineSlug: 'phantom', name: 'Phantom 4', slug: 'phantom-4', aliases: ['phantom 4', 'dji phantom 4'], position: 20 },
];

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function hasWholePhrase(text: string, phrase: string) {
  const normalizedPhrase = normalizeText(phrase);
  return (` ${text} `).includes(` ${normalizedPhrase} `);
}

function phraseSpecificity(phrase: string) {
  return normalizeText(phrase)
    .split(' ')
    .filter((token) => token && token !== 'dji').length;
}

export function detectDroneModels(value: string): DroneModelDetection[] {
  const text = normalizeText(value);
  if (!text) return [];

  const candidates = droneModelDefinitions
    .map((model) => {
      const matchedAlias = model.aliases
        .map((alias) => normalizeText(alias))
        .filter((alias) => hasWholePhrase(text, alias))
        .sort((left, right) => right.length - left.length)[0];

      return matchedAlias ? { model, matchedAlias } : null;
    })
    .filter(
      (candidate): candidate is { model: DroneModelDefinition; matchedAlias: string } =>
        Boolean(candidate)
    );

  const highestSpecificityByLine = new Map<string, number>();
  candidates.forEach(({ model, matchedAlias }) => {
    const current = highestSpecificityByLine.get(model.lineSlug) ?? 0;
    highestSpecificityByLine.set(
      model.lineSlug,
      Math.max(current, phraseSpecificity(matchedAlias))
    );
  });

  return candidates
    .filter(({ model, matchedAlias }) => {
      return highestSpecificityByLine.get(model.lineSlug) === phraseSpecificity(matchedAlias);
    })
    .map(({ model, matchedAlias }) => ({
      modelSlug: model.slug,
      matchedAlias,
      confidence: 'review' as const,
    }))
    .sort((left, right) => left.modelSlug.localeCompare(right.modelSlug));
}
