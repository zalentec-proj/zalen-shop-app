import { parseProductDescription } from '@/modules/catalog/product-description';

interface ProductDescriptionProps {
  description?: string;
}

export function ProductDescription({ description }: ProductDescriptionProps) {
  const blocks = parseProductDescription(description);

  if (blocks.length === 0) {
    return null;
  }

  return (
    <section aria-label="Descrição do produto" className="space-y-4 text-sm leading-7 text-brand-muted">
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          return (
            <h2
              key={`${block.type}-${index}`}
              className="pt-1 text-base font-bold tracking-tight text-white first:pt-0"
            >
              {block.content}
            </h2>
          );
        }

        if (block.type === 'list') {
          return (
            <ul key={`${block.type}-${index}`} className="space-y-2 pl-5 marker:text-green-accent list-disc">
              {block.items.map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`}>{item}</li>
              ))}
            </ul>
          );
        }

        return <p key={`${block.type}-${index}`}>{block.content}</p>;
      })}
    </section>
  );
}
