'use client';
export default function StoreManagementError({ reset }: { reset: () => void }) {
  return <section role="alert" className="rounded-xl border border-amber-400/20 bg-[#081225] p-6">
    <h1 className="font-semibold">Não foi possível carregar a loja</h1>
    <p className="mt-2 text-sm text-slate-400">Tente novamente em instantes. Se a atualização da plataforma ainda estiver em andamento, aguarde sua conclusão.</p>
    <button onClick={reset} className="mt-4 text-sm text-blue-300 underline">Tentar novamente</button>
  </section>;
}
