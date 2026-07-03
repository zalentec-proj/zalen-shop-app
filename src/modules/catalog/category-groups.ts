export type CategoryGroupKey =
  | 'drones'
  | 'pecas'
  | 'baterias'
  | 'acessorios'
  | 'kits-e-combos';

export interface CategoryGroupCandidate {
  name: string;
  slug: string;
}

const rootSlugs = new Set<CategoryGroupKey>([
  'drones',
  'pecas',
  'baterias',
  'acessorios',
  'kits-e-combos',
]);

const groupMatchers: Record<CategoryGroupKey, string[]> = {
  drones: ['drone', 'drones'],
  pecas: [
    'peca',
    'pecas',
    'parte',
    'partes',
    'componente',
    'componentes',
    'helice',
    'helices',
    'rotor',
    'rotores',
    'braco',
    'bracos',
    'frame',
    'frames',
    'carcaca',
    'carcacas',
    'dobradica',
    'dobradicas',
    'eixo',
    'eixos',
    'acabamento',
    'acabamentos',
    'camera',
    'cameras',
    'cmos',
    'gimbal',
    'gimbals',
    'ptz',
    'cabo',
    'cabos',
    'placa',
    'placas',
    'esc',
    'controladora',
    'controladoras',
    'sensor',
    'sensores',
    'imu',
    'gps',
    'motor',
    'motores',
  ],
  baterias: ['bateria', 'baterias'],
  acessorios: [
    'acessorio',
    'acessorios',
    'controle',
    'controles',
    'remoto',
    'remotos',
    'carregador',
    'carregadores',
    'hub',
    'hubs',
    'pelicula',
    'peliculas',
    'protecao',
    'protecoes',
    'case',
    'maleta',
    'mochila',
  ],
  'kits-e-combos': ['kit', 'kits', 'combo', 'combos'],
};

export function normalizeCategoryText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function getCategorySearchText(category: CategoryGroupCandidate) {
  return normalizeCategoryText(`${category.name} ${category.slug}`);
}

export function getCategoryGroupKey(
  category: CategoryGroupCandidate
): CategoryGroupKey | null {
  const normalizedSlug = normalizeCategoryText(category.slug) as CategoryGroupKey;

  if (rootSlugs.has(normalizedSlug)) {
    return normalizedSlug;
  }

  const text = getCategorySearchText(category);

  for (const [groupKey, matchers] of Object.entries(groupMatchers) as Array<
    [CategoryGroupKey, string[]]
  >) {
    if (matchers.some((matcher) => text.includes(matcher))) {
      return groupKey;
    }
  }

  return null;
}

export function isCategoryGroupRoot(category: CategoryGroupCandidate) {
  return rootSlugs.has(normalizeCategoryText(category.slug) as CategoryGroupKey);
}

