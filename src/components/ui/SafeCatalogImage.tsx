'use client';

import { useEffect, useState, type ImgHTMLAttributes } from 'react';
import { droneAccessoriesImage } from '@/assets/images';
import { isRenderableCatalogImageUrl } from '@/modules/catalog/catalog-image-url';

type SafeCatalogImageProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  'src'
> & {
  src?: string;
  fallbackSrc?: string;
};

export function SafeCatalogImage({
  src,
  fallbackSrc = droneAccessoriesImage,
  onError,
  ...props
}: SafeCatalogImageProps) {
  const safeSource = isRenderableCatalogImageUrl(src) ? src : fallbackSrc;
  const [resolvedSrc, setResolvedSrc] = useState(safeSource);

  useEffect(() => {
    setResolvedSrc(safeSource);
  }, [safeSource]);

  return (
    <img
      {...props}
      src={resolvedSrc}
      onError={(event) => {
        onError?.(event);
        if (resolvedSrc !== fallbackSrc) {
          setResolvedSrc(fallbackSrc);
        }
      }}
    />
  );
}
