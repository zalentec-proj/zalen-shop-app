import {
  droneAccessoriesImage,
  mavic3ProImage,
  mini4ProImage,
} from '../assets/images';
import { Product } from '../types';

export const products: Product[] = [
  {
    id: 'dji-mavic-3-pro',
    name: 'DJI Mavic 3 Pro',
    subtitle: 'Eleve sua criatividade para outro nível.',
    price: 12999.00,
    rating: 4.9,
    reviewsCount: 128,
    image: mavic3ProImage,
    images: [
      mavic3ProImage,
      mini4ProImage,
      droneAccessoriesImage,
    ],
    category: 'Drones',
    description: 'Drone profissional com câmera Hasselblad, autonomia avançada e sistema inteligente de detecção para voos mais seguros e precisos. Câmera tripla Hasselblad. Performance incomparável. Criado para capturar imagens profissionais com estabilidade, alcance e precisão.',
    specs: [
      { label: 'Câmera Hasselblad', value: '4/3 CMOS' },
      { label: 'Autonomia', value: 'Até 46 min' },
      { label: 'Transmissão', value: '15km (O3+)' },
      { label: 'Detecção', value: '360°' }
    ],
    isBestSeller: true,
    isNew: true
  },
  {
    id: 'dji-mini-4-pro',
    name: 'DJI Mini 4 Pro',
    subtitle: 'O mini drone com máxima performance.',
    price: 6999.00,
    rating: 4.8,
    reviewsCount: 94,
    image: mini4ProImage,
    category: 'Drones',
    description: 'Nosso mini drone mais avançado até hoje. Integra poderosos recursos de imagem, detecção de obstáculos omnidirecional, ActiveTrack 360° e transmissão de vídeo FHD a 20 km.',
    specs: [
      { label: 'Câmera principal', value: '1/1.3" CMOS' },
      { label: 'Peso', value: 'Abaixo de 249g' },
      { label: 'Autonomia', value: 'Até 34 min' },
      { label: 'Detecção', value: 'Omnidirecional' }
    ],
    isBestSeller: true,
    isNew: true
  },
  {
    id: 'dji-air-3-fly-more',
    name: 'DJI Air 3 Fly More Combo',
    subtitle: 'Dobre suas perspectivas de captura.',
    price: 10999.00,
    rating: 4.9,
    reviewsCount: 42,
    image: mavic3ProImage,
    category: 'Kits e Combos',
    description: 'Com um sistema de câmeras duplas primárias, o DJI Air 3 traz detalhes incríveis de longo alcance e perspectivas amplas. Inclui 3 baterias adicionais, hélices extras, hub de carregamento e bolsa de transporte.',
    specs: [
      { label: 'Câmera dupla', value: 'Duplo 1/1.3" CMOS' },
      { label: 'Autonomia', value: 'Até 46 min' },
      { label: 'Transmissão', value: '20km (O4)' },
      { label: 'Baterias', value: '3 Inclusas' }
    ],
    isBestSeller: true
  },
  {
    id: 'bateria-dji-mini-3-pro',
    name: 'Bateria DJI Mini 3 Pro',
    subtitle: 'Voe por mais tempo com segurança.',
    price: 899.00,
    rating: 4.7,
    reviewsCount: 165,
    image: droneAccessoriesImage,
    category: 'Baterias',
    description: 'Bateria de Voo Inteligente DJI original para Mini 3 Pro e Mini 4 Pro. Fornece energia estável, monitoramento de status em tempo real e tempo de voo estendido.',
    specs: [
      { label: 'Capacidade', value: '2453 mAh' },
      { label: 'Tipo', value: 'LiPo 2S' },
      { label: 'Peso', value: '80.5g' },
      { label: 'Garantia', value: 'Oficial DJI' }
    ],
    isBestSeller: true
  },
  {
    id: 'helices-dji-air-3',
    name: 'Hélices DJI Air 3 (Par)',
    subtitle: 'Propulsão otimizada e baixo ruído.',
    price: 199.00,
    rating: 4.6,
    reviewsCount: 88,
    image: droneAccessoriesImage,
    category: 'Peças',
    description: 'Hélices de reposição originais para DJI Air 3. Projetadas para produzir menos ruído, maior eficiência aerodinâmica e excelente força de tração rotacional.',
    specs: [
      { label: 'Compatibilidade', value: 'DJI Air 3' },
      { label: 'Construção', value: 'Fibra de Carbono' },
      { label: 'Tipo', value: 'Baixo Ruído' },
      { label: 'Conteúdo', value: '1 Par' }
    ]
  },
  {
    id: 'case-impermeavel',
    name: 'Case Impermeável Pro',
    subtitle: 'Proteção máxima em ambientes extremos.',
    price: 349.00,
    rating: 4.8,
    reviewsCount: 31,
    image: droneAccessoriesImage,
    category: 'Acessórios',
    description: 'Maleta rígida hermética à prova d\'água, poeira e impactos externos. Espuma interna recortada a laser de alta densidade, compatível com múltiplos modelos de drones compactos.',
    specs: [
      { label: 'Proteção', value: 'IP67 Impermeável' },
      { label: 'Espuma', value: 'Recortada a laser' },
      { label: 'Válvula', value: 'Pressão automática' },
      { label: 'Peso', value: '1.2 kg' }
    ]
  }
];
