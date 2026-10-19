import { z } from 'zod';
import { ACTIVE_STORE_ID } from '@/modules/stores/current-store';

const text = (max: number) => z.string().trim().max(max);
// These URLs are rendered by the browser, never fetched by the application server.
const imageUrl = text(1024).refine((value) => {
  if (!value) return true;
  if (/^\/brand\/[a-zA-Z0-9/_.-]+\.(png|jpe?g|webp|avif)$/i.test(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password &&
      /\.(png|jpe?g|webp|avif)$/i.test(url.pathname);
  } catch { return false; }
}, 'Use uma imagem PNG, JPG, WebP ou AVIF em um endereço HTTPS.');

export const presentationSchema = z.object({
  renderer: z.enum(['neutral', 'brasil-drones']),
  visualStyle: z.enum(['essential', 'editorial']).default('essential'),
  announcement: text(160).default(''),
  heroEyebrow: text(80).default(''),
  heroHighlight: text(60).default(''),
  aboutText: text(800).default(''),
  featuredTopics: z.array(text(50).min(2)).max(6).default([]),
  brandName: text(100).min(2),
  logoUrl: imageUrl,
  faviconUrl: imageUrl,
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  heroTitle: text(120),
  heroDescription: text(500),
  bannerUrl: imageUrl,
  footerText: text(600),
  email: text(254).refine((v) => !v || z.email().safeParse(v).success, 'Informe um e-mail válido.'),
  phone: text(30),
  whatsapp: z.string().regex(/^$|^[1-9][0-9]{9,14}$/, 'Informe o WhatsApp com país e DDD, somente números.'),
  instagramUrl: text(300).refine((v) => {
    if (!v) return true;
    try { const u = new URL(v); return u.protocol === 'https:' && ['instagram.com', 'www.instagram.com'].includes(u.hostname) && !u.username && !u.password; }
    catch { return false; }
  }, 'Use um endereço HTTPS do Instagram.'),
  seoTitle: text(100),
  seoDescription: text(300),
}).strict();

export type StorePresentation = z.infer<typeof presentationSchema>;

export function defaultPresentation(store: { id: string; name: string; slug: string }): StorePresentation {
  const brasil = store.id === ACTIVE_STORE_ID && store.slug === 'brasil-drones';
  return {
    renderer: brasil ? 'brasil-drones' : 'neutral', brandName: store.name,
    visualStyle: 'essential', announcement: '', heroEyebrow: '', heroHighlight: '', aboutText: '', featuredTopics: [],
    logoUrl: '', faviconUrl: '', primaryColor: '#1E3DFF', accentColor: '#00E676',
    heroTitle: brasil ? '' : store.name, heroDescription: '', bannerUrl: '',
    footerText: brasil ? 'A Brasil Drones & Parts é especializada em drones e peças de alta performance, oferecendo tecnologia, suporte e segurança para elevar seus projetos de mapeamento, filmagem ou inspeção técnica.' : '',
    email: '', phone: '', whatsapp: brasil ? '5545999431780' : '',
    instagramUrl: brasil ? 'https://www.instagram.com/dronesepartsbrasildji/' : '',
    seoTitle: brasil ? `${store.name} — Drones e Peças DJI` : store.name,
    seoDescription: brasil ? 'Equipamentos originais, peças selecionadas e suporte técnico para quem exige segurança, precisão e liberdade em cada voo.' : '',
  };
}

export function isRendererAllowed(renderer: StorePresentation['renderer'], store: { id: string; slug: string }) {
  return renderer === 'neutral' || (store.id === ACTIVE_STORE_ID && store.slug === 'brasil-drones');
}
