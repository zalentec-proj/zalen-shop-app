export interface Product {
  id: string;
  name: string;
  subtitle?: string;
  price: number;
  originalPrice?: number;
  rating: number;
  reviewsCount: number;
  image: string;
  images?: string[];
  category: string;
  description: string;
  specs: {
    label: string;
    value: string;
  }[];
  isBestSeller?: boolean;
  isNew?: boolean;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface FilterState {
  category: string | null;
  minPrice: number;
  maxPrice: number;
}
