import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, CheckCircle2, MapPin, Plus, Trash2 } from 'lucide-react';
import { createOptionalClient } from '@/lib/supabase/server';
import { getCustomerAccountForUser } from '@/modules/customer-account/customer-account.service';
import type { CustomerAddress } from '@/modules/customers/customer.types';
import { noindexMetadata } from '@/modules/seo/seo.service';
import { resolveCurrentStoreFromHeaders } from '@/modules/stores/store-resolution';
import CustomerAccountHeader from '../CustomerAccountHeader';
import {
  deleteCustomerAddressAction,
  saveCustomerAddressAction,
  setDefaultCustomerAddressAction,
} from './actions';

export const metadata: Metadata = {
  title: 'Meus endereços — Brasil Drones & Parts',
  ...noindexMetadata,
};

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams?: Promise<{
    enderecos?: string;
  }>;
}

function statusMessage(status: string | undefined) {
  const messages: Record<string, string> = {
    salvo: 'Endereço salvo.',
    padrao: 'Endereço padrão atualizado.',
    removido: 'Endereço removido.',
    dados_invalidos: 'Revise os dados do endereço.',
    erro: 'Não foi possível atualizar o endereço agora.',
  };

  return status ? messages[status] : undefined;
}

function addressLine(address: CustomerAddress) {
  return [
    [address.street, address.number].filter(Boolean).join(', '),
    address.district,
    [address.city, address.state].filter(Boolean).join('/'),
    address.postalCode ? `CEP ${address.postalCode}` : undefined,
  ]
    .filter(Boolean)
    .join(' • ');
}

export default async function CustomerAddressesPage({
  searchParams,
}: PageProps) {
  const supabase = await createOptionalClient();
  const search = await searchParams;

  if (!supabase) {
    redirect('/conta/entrar?next=/conta/enderecos');
  }

  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect('/conta/entrar?next=/conta/enderecos');
  }

  const store = await resolveCurrentStoreFromHeaders();
  const account = await getCustomerAccountForUser({
    storeId: store.id,
    authUserId: data.user.id,
    email: data.user.email,
  });
  const addresses = account?.addresses ?? [];
  const message = statusMessage(search?.enderecos);

  return (
    <main className="min-h-screen bg-brand-bg px-4 py-8 text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <CustomerAccountHeader email={data.user.email} />

        <Link
          href="/conta"
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand-muted hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para minha conta
        </Link>

        <section className="rounded-2xl border border-brand-border bg-[#090E17]/90 p-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-blue-primary">
            Meus endereços
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">
            Entregas salvas
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-brand-muted">
            Escolha um endereço padrão para agilizar próximas compras ou cadastre
            outro local de entrega.
          </p>
        </section>

        {message ? (
          <div className="rounded-2xl border border-green-accent/25 bg-green-accent/10 p-4 text-sm font-semibold text-green-accent">
            {message}
          </div>
        ) : null}

        <section className="rounded-2xl border border-brand-border bg-[#090E17]/90 p-5">
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-blue-primary" />
            <h2 className="text-lg font-black">Adicionar endereço</h2>
          </div>
          <AddressForm submitLabel="Salvar endereço" />
        </section>

        <section className="grid gap-4">
          {addresses.length > 0 ? (
            addresses.map((address) => (
              <article
                key={address.id}
                className="rounded-2xl border border-brand-border bg-[#090E17]/90 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-blue-primary" />
                      <h2 className="text-lg font-black">{address.label}</h2>
                      {address.isDefault ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-green-accent/30 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-green-accent">
                          <CheckCircle2 className="h-3 w-3" />
                          Padrão
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm text-brand-muted">
                      {addressLine(address) || 'Endereço incompleto'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!address.isDefault ? (
                      <form action={setDefaultCustomerAddressAction}>
                        <input type="hidden" name="addressId" value={address.id} />
                        <button className="h-10 rounded-xl border border-green-accent/30 px-4 text-xs font-bold text-green-accent transition hover:bg-green-accent/10">
                          Usar como padrão
                        </button>
                      </form>
                    ) : null}
                    <form action={deleteCustomerAddressAction}>
                      <input type="hidden" name="addressId" value={address.id} />
                      <button className="inline-flex h-10 items-center gap-2 rounded-xl border border-red-400/30 px-4 text-xs font-bold text-red-200 transition hover:bg-red-500/10">
                        <Trash2 className="h-4 w-4" />
                        Remover
                      </button>
                    </form>
                  </div>
                </div>
                <AddressForm address={address} submitLabel="Salvar alterações" />
              </article>
            ))
          ) : (
            <div className="rounded-2xl border border-brand-border bg-[#090E17]/90 p-6 text-sm text-brand-muted">
              Nenhum endereço salvo ainda.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function AddressForm({
  address,
  submitLabel,
}: {
  address?: CustomerAddress;
  submitLabel: string;
}) {
  return (
    <form action={saveCustomerAddressAction} className="mt-5 grid gap-3">
      {address ? (
        <input type="hidden" name="addressId" value={address.id} />
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        <AddressInput
          label="Nome do endereço"
          name="label"
          defaultValue={address?.label}
          placeholder="Casa, empresa..."
        />
        <AddressInput
          label="Destinatário"
          name="recipientName"
          defaultValue={address?.recipientName}
          placeholder="Nome de quem recebe"
        />
        <AddressInput
          label="Telefone"
          name="phone"
          defaultValue={address?.phone}
          placeholder="DDD + número"
        />
        <AddressInput
          label="CEP"
          name="postalCode"
          defaultValue={address?.postalCode}
          required
        />
        <AddressInput
          label="Rua/Avenida"
          name="street"
          defaultValue={address?.street}
          required
        />
        <AddressInput
          label="Número"
          name="number"
          defaultValue={address?.number}
          required
        />
        <AddressInput
          label="Complemento"
          name="complement"
          defaultValue={address?.complement}
        />
        <AddressInput
          label="Bairro"
          name="district"
          defaultValue={address?.district}
          required
        />
        <AddressInput
          label="Cidade"
          name="city"
          defaultValue={address?.city}
          required
        />
        <AddressInput
          label="UF"
          name="state"
          defaultValue={address?.state}
          required
          maxLength={2}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-4">
        <label className="flex items-center gap-2 text-xs font-semibold text-brand-muted">
          <input
            type="checkbox"
            name="isDefault"
            defaultChecked={address?.isDefault}
          />
          Usar como endereço padrão
        </label>
        <button className="h-11 rounded-xl bg-blue-primary px-5 text-sm font-black text-white shadow-[0_8px_24px_rgba(30,61,255,0.28)] transition hover:opacity-95">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function AddressInput({
  label,
  name,
  defaultValue,
  placeholder,
  required,
  maxLength,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-brand-muted">
        {label}
      </span>
      <input
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder ?? label}
        required={required}
        maxLength={maxLength}
        className="h-11 w-full rounded-xl border border-brand-border-soft bg-[#050A14]/80 px-3 text-sm font-semibold text-white outline-none transition placeholder:text-brand-muted focus:border-blue-primary/60"
      />
    </label>
  );
}
