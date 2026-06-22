import { getCurrentUser } from '@/modules/auth/auth.service';
import CartClient from './CartClient';

export const metadata = {
  title: 'Carrinho — Brasil Drones & Parts',
};

export default async function CartPage() {
  const user = await getCurrentUser();

  return (
    <CartClient
      customerSession={user ? { email: user.email } : null}
    />
  );
}
