'use client';

import { AlertCircle, CheckCircle2, LoaderCircle, X } from 'lucide-react';
import {
  useActionState,
  useEffect,
  useState,
  type FormHTMLAttributes,
  type ReactNode,
} from 'react';
import type { AdminActionResult } from '@/modules/admin/admin-action-result';

type FeedbackState = {
  status: 'idle' | 'success' | 'error';
  message: string;
  submission: number;
};

type AdminActionFormProps = Omit<
  FormHTMLAttributes<HTMLFormElement>,
  'action' | 'children'
> & {
  action: (formData: FormData) => Promise<AdminActionResult | void>;
  children: ReactNode;
  successMessage: string;
  pendingMessage?: string;
  errorMessage?: string;
};

const initialState: FeedbackState = {
  status: 'idle',
  message: '',
  submission: 0,
};

export function AdminActionForm({
  action,
  children,
  successMessage,
  pendingMessage = 'Salvando alterações…',
  errorMessage = 'Não foi possível concluir a ação. Revise os dados e tente novamente.',
  ...formProps
}: AdminActionFormProps) {
  const [visible, setVisible] = useState(false);
  const [state, formAction, pending] = useActionState<FeedbackState, FormData>(
    async (previousState, formData) => {
      try {
        const result = await action(formData);

        return {
          status: result?.ok === false ? 'error' : 'success',
          message: result?.message || successMessage,
          submission: previousState.submission + 1,
        };
      } catch {
        return {
          status: 'error',
          message: errorMessage,
          submission: previousState.submission + 1,
        };
      }
    },
    initialState
  );

  useEffect(() => {
    if (state.status === 'idle') return;

    setVisible(true);
    const timeout = window.setTimeout(() => setVisible(false), 5000);
    return () => window.clearTimeout(timeout);
  }, [state.status, state.submission]);

  const feedback = pending
    ? { status: 'pending' as const, message: pendingMessage }
    : visible && state.status !== 'idle'
      ? state
      : null;

  return (
    <form {...formProps} action={formAction} aria-busy={pending}>
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {feedback ? (
        <div
          role={feedback.status === 'error' ? 'alert' : 'status'}
          aria-live={feedback.status === 'error' ? 'assertive' : 'polite'}
          className={`fixed bottom-4 left-1/2 z-[80] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-[0_20px_60px_rgba(0,0,0,.55)] backdrop-blur sm:bottom-6 sm:left-auto sm:right-6 sm:translate-x-0 ${
            feedback.status === 'error'
              ? 'border-rose-400/25 bg-[#2A101C]/95 text-rose-100'
              : feedback.status === 'success'
                ? 'border-emerald-400/25 bg-[#09251F]/95 text-emerald-100'
                : 'border-blue-400/25 bg-[#0A1730]/95 text-blue-100'
          }`}
        >
          {feedback.status === 'pending' ? (
            <LoaderCircle className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
          ) : feedback.status === 'success' ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span className="min-w-0 flex-1 leading-5">{feedback.message}</span>
          {feedback.status !== 'pending' ? (
            <button
              type="button"
              onClick={() => setVisible(false)}
              aria-label="Fechar mensagem"
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md opacity-70 transition hover:bg-white/10 hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
