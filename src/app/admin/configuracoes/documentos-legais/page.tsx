import Link from 'next/link';
import { Save } from 'lucide-react';
import { SettingsPanel } from '../SettingsShell';
import { listStoreLegalDocuments, legalDocumentKeys } from '@/modules/legal/legal.repository';
import { resolveCurrentStoreFromHeaders } from '@/modules/stores/store-resolution';
import { saveStoreLegalDocumentAction } from './actions';

const labels = {
  privacy: 'Política de privacidade',
  terms: 'Termos de uso',
  returns: 'Trocas e devoluções',
  contact: 'Contato',
} as const;

export default async function LegalDocumentsSettingsPage() {
  const store = await resolveCurrentStoreFromHeaders();
  const documents = await listStoreLegalDocuments(store.id);

  return (
    <div className="space-y-4">
      <SettingsPanel
        title="Documentos legais"
        description="Textos públicos da loja. Publique somente depois de revisão jurídica e operacional."
      >
        <div className="grid gap-3 text-xs text-slate-400">
          <span>Sem HTML ou scripts. Use texto simples e parágrafos separados por uma linha em branco.</span>
          <Link href="/" className="font-semibold text-[#A9C7FF] hover:text-white">Ver loja</Link>
        </div>
      </SettingsPanel>

      {legalDocumentKeys.map((key) => {
        const document = documents.find((item) => item.documentKey === key);

        return (
          <form key={key} action={saveStoreLegalDocumentAction} className="space-y-3 rounded-lg border border-white/6 bg-[#081225] p-4">
            <input type="hidden" name="documentKey" value={key} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-white">{labels[key]}</h2>
              <select name="status" defaultValue={document?.status ?? 'draft'} className="h-9 rounded-lg border border-white/8 bg-[#050A14] px-3 text-xs text-white">
                <option value="draft">Rascunho</option>
                <option value="published">Publicado</option>
              </select>
            </div>
            <input name="title" defaultValue={document?.title ?? labels[key]} className="h-10 w-full rounded-lg border border-white/8 bg-[#050A14] px-3 text-sm text-white" />
            <div className="grid gap-3 md:grid-cols-[180px_1fr]">
              <input name="version" defaultValue={document?.version ?? 'v1'} className="h-10 rounded-lg border border-white/8 bg-[#050A14] px-3 text-sm text-white" />
              <textarea name="content" defaultValue={document?.content ?? ''} rows={10} placeholder="Cole o texto revisado aqui." className="w-full rounded-lg border border-white/8 bg-[#050A14] px-3 py-2 text-sm leading-6 text-white" />
            </div>
            <button type="submit" className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#1E3DFF] px-4 text-xs font-semibold text-white hover:bg-[#3151ff]">
              <Save className="h-4 w-4" /> Salvar documento
            </button>
          </form>
        );
      })}
    </div>
  );
}
