import Link from 'next/link';
import { Save } from 'lucide-react';
import { SettingsPanel } from '../SettingsShell';
import { AdminBadge } from '@/components/admin/AdminLayout';
import { AdminDrawer } from '@/components/admin/AdminDrawer';
import { AdminActionForm } from '@/components/admin/AdminActionForm';
import { listStoreLegalDocuments, legalDocumentKeys } from '@/modules/legal/legal.repository';
import { resolveCurrentStoreFromHeaders } from '@/modules/stores/store-resolution';
import { saveStoreLegalDocumentAction } from './actions';

const labels = {
  privacy: 'Política de privacidade',
  terms: 'Termos de uso',
  returns: 'Trocas e devoluções',
  contact: 'Contato',
} as const;

export default async function LegalDocumentsSettingsPage({ searchParams }: { searchParams: Promise<{ record?: string }> }) {
  const params = await searchParams;
  const store = await resolveCurrentStoreFromHeaders();
  const documents = await listStoreLegalDocuments(store.id);
  const selectedKey = legalDocumentKeys.find((key) => key === params.record);
  const selectedDocument = documents.find((item) => item.documentKey === selectedKey);

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

      <SettingsPanel title="Conteúdo publicado" description="Abra um documento para revisar ou editar.">
        <div className="divide-y divide-white/6 overflow-hidden rounded-lg border border-white/6">
      {legalDocumentKeys.map((key) => {
        const document = documents.find((item) => item.documentKey === key);
        return <div key={key} className="grid gap-2 bg-[#081225] px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"><div><h2 className="text-sm font-semibold text-white">{labels[key]}</h2><p className="mt-1 text-[11px] text-slate-500">{document?.version ?? 'v1'}{document?.updatedAt ? ` · atualizado em ${new Intl.DateTimeFormat('pt-BR').format(new Date(document.updatedAt))}` : ''}</p></div><AdminBadge tone={document?.status === 'published' ? 'success' : 'warning'}>{document?.status === 'published' ? 'Publicado' : 'Rascunho'}</AdminBadge><Link href={`/admin/configuracoes/documentos-legais?record=${key}`} scroll={false} className="text-xs font-semibold text-blue-300">Editar</Link></div>;
      })}
        </div>
      </SettingsPanel>

      {selectedKey ? <AdminDrawer title={labels[selectedKey]} description="Somente texto simples; publique após revisão."><AdminActionForm action={saveStoreLegalDocumentAction} successMessage="Documento legal salvo com sucesso." className="space-y-3"><input type="hidden" name="documentKey" value={selectedKey}/><label className="grid gap-1 text-xs">Status<select name="status" defaultValue={selectedDocument?.status ?? 'draft'} className="h-9 rounded-lg border border-white/8 bg-[#050A14] px-3"><option value="draft">Rascunho</option><option value="published">Publicado</option></select></label><label className="grid gap-1 text-xs">Título<input name="title" defaultValue={selectedDocument?.title ?? labels[selectedKey]} className="h-10 rounded-lg border border-white/8 bg-[#050A14] px-3"/></label><label className="grid gap-1 text-xs">Versão<input name="version" defaultValue={selectedDocument?.version ?? 'v1'} className="h-10 rounded-lg border border-white/8 bg-[#050A14] px-3"/></label><label className="grid gap-1 text-xs">Conteúdo<textarea name="content" defaultValue={selectedDocument?.content ?? ''} rows={16} placeholder="Cole o texto revisado aqui." className="rounded-lg border border-white/8 bg-[#050A14] px-3 py-2 text-sm leading-6"/></label><button type="submit" className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#1E3DFF] px-4 text-xs font-semibold text-white disabled:cursor-wait disabled:opacity-60"><Save className="h-4 w-4"/>Salvar documento</button></AdminActionForm></AdminDrawer>:null}
    </div>
  );
}
