import Link from 'next/link';
import Footer from '@/components/layout/Footer';
import {
  getPublishedStoreLegalDocument,
  type LegalDocumentKey,
} from '@/modules/legal/legal.repository';
import { resolveCurrentStoreFromHeaders } from '@/modules/stores/store-resolution';

export default async function StoreLegalDocumentPage({
  documentKey,
  fallbackTitle,
}: {
  documentKey: LegalDocumentKey;
  fallbackTitle: string;
}) {
  const store = await resolveCurrentStoreFromHeaders();
  const document = await getPublishedStoreLegalDocument({
    storeId: store.id,
    documentKey,
  });
  const paragraphs = document?.content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean) ?? [];

  return (
    <main className="min-h-screen bg-brand-bg text-white">
      <section className="mx-auto w-full max-w-3xl px-5 py-16 sm:px-8">
        <Link href="/" className="text-sm font-semibold text-blue-primary hover:text-white">
          Voltar para a loja
        </Link>
        <p className="mt-8 text-xs font-black uppercase tracking-[0.18em] text-blue-primary">
          {store.shortName}
        </p>
        <h1 className="mt-3 text-3xl font-black">{document?.title ?? fallbackTitle}</h1>
        {document ? (
          <>
            <p className="mt-3 text-sm text-brand-muted">Versão {document.version}</p>
            <div className="mt-10 space-y-5 text-sm leading-7 text-slate-200">
              {paragraphs.map((paragraph, index) => (
                <p key={`${index}-${paragraph.slice(0, 24)}`} className="whitespace-pre-line">
                  {paragraph}
                </p>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-8 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
            Este documento está em revisão. Entre em contato com a loja antes de concluir uma compra.
          </p>
        )}
      </section>
      <Footer />
    </main>
  );
}
