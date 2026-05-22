import React from 'react';
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
  const sizeClass =
    size === 'sm'
      ? 'h-9 md:h-10'
      : size === 'lg'
        ? 'h-14 md:h-16'
        : 'h-11 md:h-12';

  return (
    <img
      src={logoBrasil}
      alt="Brasil Drones & Parts"
      className={`w-auto max-w-none select-none ${sizeClass} ${className}`}
      draggable={false}
    />
  );
}
