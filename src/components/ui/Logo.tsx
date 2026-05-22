import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function Logo({ className = '', size = 'md' }: LogoProps) {
  // Compute sizing
  const scale = size === 'sm' ? 'scale-75 origin-left' : size === 'lg' ? 'scale-125' : 'scale-100';

  return (
    <div className={`flex items-center gap-3 select-none ${scale} ${className}`}>
      {/* Visual Icon: Orbit representation & central star spark */}
      <div className="relative w-12 h-12 flex items-center justify-center">
        {/* Subtle background glow */}
        <div className="absolute inset-0 bg-blue-primary/20 blur-lg rounded-full animate-pulse"></div>
        
        {/* SVG Icon matching workspace_image_1.png */}
        <svg
          viewBox="0 0 100 100"
          className="w-11 h-11 relative z-10"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Glowing orbital ring */}
          <path
            d="M85 35 C88 42, 65 65, 35 72 C10 78, 8 70, 15 62 C25 50, 75 22, 85 35 Z"
            stroke="white"
            strokeOpacity="0.8"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          {/* Secondary flight orbit path */}
          <path
            d="M15 45 C18 35, 45 15, 75 18 C85 20, 80 32, 70 38 C55 48, 25 55, 15 45 Z"
            stroke="white"
            strokeOpacity="0.15"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* Central 4-pointed aerospace spark star */}
          <path
            d="M50 25 C50 40, 40 50, 25 50 C40 50, 50 60, 50 75 C50 60, 60 50, 75 50 C60 50, 50 40, 50 25 Z"
            fill="white"
            fillOpacity="0.9"
          />
        </svg>
      </div>

      {/* Brand Name matching brand typography */}
      <div className="flex flex-col justify-center">
        <div className="flex items-baseline relative">
          {/* "brasil" font design with high weight and accurate custom details */}
          <span className="text-3xl font-bold tracking-tight text-blue-primary select-none font-sans lowercase">
            bras
          </span>
          {/* "i" with green dot */}
          <span className="text-3xl font-bold tracking-tight text-blue-primary select-none font-sans relative">
            i
            <span className="absolute -top-[5px] left-1/2 -translate-x-1/2 w-[8px] h-[8px] bg-green-accent rounded-full shadow-[0_0_8px_rgba(0,230,118,0.8)]"></span>
          </span>
          <span className="text-3xl font-bold tracking-tight text-blue-primary select-none font-sans relative lowercase">
            l
            {/* Lower-right green dot near the 'l' */}
            <span className="absolute bottom-[2px] -right-4 w-[12px] h-[12px] bg-green-accent rounded-full shadow-[0_0_12px_rgba(0,230,118,0.85)]"></span>
          </span>
        </div>
        
        {/* "DRONES & PARTS" subtitle */}
        <span className="text-[9px] tracking-[0.38em] font-light text-brand-muted font-display uppercase whitespace-nowrap -mt-1 ml-0.5">
          DRONES & PARTS
        </span>
      </div>
    </div>
  );
}
