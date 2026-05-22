/**
 * Página de categoria.
 * Placeholder — será implementado na Sprint 2.
 */

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;

  return (
    <main className="min-h-screen bg-brand-bg flex items-center justify-center">
      <div className="text-center text-brand-muted">
        <p className="text-sm">Categoria: {slug}</p>
        <p className="text-xs mt-2 opacity-50">Em breve</p>
      </div>
    </main>
  );
}
