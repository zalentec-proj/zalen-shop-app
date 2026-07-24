'use client';

import { useActionState, useState } from 'react';
import { Building2, Save } from 'lucide-react';
import {
  type BusinessProfileState,
  updateBusinessProfileAction,
} from './actions';

const initialState: BusinessProfileState = {};

export default function BusinessProfileForm({
  customer,
}: {
  customer: {
    name: string;
    document?: string;
    legalName?: string;
    stateRegistration?: string;
    stateRegistrationExempt: boolean;
    customerType: 'pf' | 'pj';
  };
}) {
  const [state, action, isPending] = useActionState(
    updateBusinessProfileAction,
    initialState
  );
  const [exempt, setExempt] = useState(customer.stateRegistrationExempt);

  return (
    <section className="rounded-2xl border border-brand-border bg-[#090E17]/90 p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-primary/25 bg-blue-primary/10 text-blue-primary">
          <Building2 className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-black">Dados empresariais</h2>
          <p className="mt-1 text-sm leading-6 text-brand-muted">
            Complete ou altere o cadastro PJ. A elegibilidade é recalculada assim
            que os dados forem salvos.
          </p>
        </div>
      </div>

      <form action={action} className="mt-5 grid gap-3 md:grid-cols-2">
        <AccountField
          label="Nome do responsável"
          name="name"
          defaultValue={customer.name}
          required
        />
        <AccountField
          label="CNPJ"
          name="document"
          defaultValue={customer.customerType === 'pj' ? customer.document : ''}
          inputMode="numeric"
          required
        />
        <AccountField
          label="Razão social"
          name="legalName"
          defaultValue={customer.legalName}
          required
        />
        <AccountField
          label="Inscrição estadual"
          name="stateRegistration"
          defaultValue={customer.stateRegistration}
          disabled={exempt}
          required={!exempt}
        />

        <label className="flex items-center gap-2 rounded-xl border border-brand-border-soft bg-[#050A14]/85 px-3 py-3 text-xs font-semibold text-brand-muted md:col-span-2">
          <input
            type="checkbox"
            name="stateRegistrationExempt"
            checked={exempt}
            onChange={(event) => setExempt(event.target.checked)}
            className="h-4 w-4 accent-blue-primary"
          />
          Empresa isenta de inscrição estadual
        </label>

        {state.error ? (
          <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200 md:col-span-2">
            {state.error}
          </p>
        ) : null}
        {state.message ? (
          <p className="rounded-xl border border-green-accent/20 bg-green-accent/10 px-3 py-2 text-xs font-semibold text-green-accent md:col-span-2">
            {state.message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-primary px-5 text-sm font-bold text-white disabled:opacity-60 md:col-span-2 md:justify-self-start"
        >
          <Save className="h-4 w-4" />
          {isPending ? 'Salvando...' : 'Salvar dados empresariais'}
        </button>
      </form>
    </section>
  );
}

function AccountField({
  label,
  name,
  defaultValue,
  inputMode,
  required,
  disabled,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  inputMode?: 'text' | 'numeric';
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-bold text-brand-muted">
      {label}
      <input
        name={name}
        defaultValue={defaultValue}
        inputMode={inputMode}
        required={required}
        disabled={disabled}
        className="h-11 rounded-xl border border-brand-border-soft bg-[#050A14]/85 px-3 text-sm font-semibold text-white outline-none transition focus:border-blue-primary/70 disabled:cursor-not-allowed disabled:opacity-50"
      />
    </label>
  );
}
