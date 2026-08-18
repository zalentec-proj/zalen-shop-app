'use client';

import { useEffect, useState, type ImgHTMLAttributes } from 'react';
import { droneAccessoriesImage } from '@/assets/images';

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
  const [resolvedSrc, setResolvedSrc] = useState(src || fallbackSrc);

  useEffect(() => {
    setResolvedSrc(src || fallbackSrc);
  }, [fallbackSrc, src]);

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
