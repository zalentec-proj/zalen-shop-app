'use client';
import React from 'react';
import { useStorefrontIdentity } from '@/modules/storefront/StorefrontIdentity';
import logoBrasilAsset from '../../assets/logo brasil.svg';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

type StaticAsset = string | { src: string };

const logoBrasil = typeof (logoBrasilAsset as StaticAsset) === 'string'
  ? logoBrasilAsset
  : (logoBrasilAsset as { src: string }).src;

export default function Logo({ className = '', size = 'md' }: LogoProps) {
  const identity = useStorefrontIdentity();
  const sizeClass =
    size === 'sm'
      ? 'h-9 md:h-10'
      : size === 'lg'
        ? 'h-14 md:h-16'
        : 'h-11 md:h-12';

  if (!identity?.logoUrl && identity?.renderer !== 'brasil-drones') return <span className={`inline-flex items-center text-xl font-semibold ${sizeClass} ${className}`}>{identity?.brandName ?? 'Zalen Shop'}</span>;
  return (
    <img
      src={identity?.logoUrl || logoBrasil}
      alt={identity?.brandName ?? 'Zalen Shop'}
      className={`w-auto max-w-none select-none ${sizeClass} ${className}`}
      draggable={false}
    />
  );
}
