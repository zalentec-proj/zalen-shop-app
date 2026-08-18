'use client';

import { useEffect, useState, type ImgHTMLAttributes } from 'react';
import logoBrasilAsset from '@/assets/logo brasil.svg';
import { isRenderableCatalogImageUrl } from '@/modules/catalog/catalog-image-url';

type SafeCatalogImageProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  'src'
> & {
  src?: string;
  fallbackSrc?: string;
};

type StaticAsset = string | { src: string };

const logoBrasil = typeof (logoBrasilAsset as StaticAsset) === 'string'
  ? logoBrasilAsset
  : (logoBrasilAsset as { src: string }).src;

export function SafeCatalogImage({
  src,
  fallbackSrc,
  onError,
  alt,
  className,
  ...props
}: SafeCatalogImageProps) {
  const safeSource = isRenderableCatalogImageUrl(src) ? src : undefined;
  const [resolvedSrc, setResolvedSrc] = useState(safeSource);

  useEffect(() => {
    setResolvedSrc(safeSource);
  }, [safeSource]);

  if (!resolvedSrc) {
    if (fallbackSrc) {
      return <img {...props} src={fallbackSrc} alt={alt} className={className} />;
    }

    return (
      <span
        role="img"
        aria-label={alt || 'Imagem indisponível do produto'}
        className={`relative flex items-center justify-center overflow-hidden bg-black p-[12%] ${className ?? ''}`}
      >
        <span className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,56,252,0.12),transparent_62%)]" />
        <img
          src={logoBrasil}
          alt=""
          aria-hidden="true"
          className="relative h-auto max-h-full w-[82%] max-w-full object-contain"
          draggable={false}
        />
      </span>
    );
  }

  return (
    <img
      {...props}
      src={resolvedSrc}
      alt={alt}
      className={className}
      onError={(event) => {
        onError?.(event);
        setResolvedSrc(undefined);
      }}
    />
  );
}
