import logoBrasilAsset from '../../assets/logo brasil.svg';

type StaticAsset = string | { src: string };

const logoBrasil =
  typeof (logoBrasilAsset as StaticAsset) === 'string'
    ? logoBrasilAsset
    : (logoBrasilAsset as { src: string }).src;

export default function BrasilDronesBrandSpotlight() {
  return (
    <section
      className="relative isolate flex min-h-[220px] items-center justify-center overflow-hidden rounded-3xl border border-blue-primary/25 bg-[#050b15] px-6 py-10 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:min-h-[270px] md:min-h-[320px]"
      aria-label="Brasil Drones & Parts"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(30,61,255,0.24),transparent_42%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(0,239,148,0.06),transparent_35%,rgba(28,103,255,0.08))]" />
      <div className="absolute inset-x-[10%] top-1/2 h-px bg-gradient-to-r from-transparent via-cyan-400/35 to-transparent" />

      <img
        src={logoBrasil}
        alt="Brasil Drones & Parts"
        className="relative z-10 h-auto w-full max-w-[270px] select-none drop-shadow-[0_18px_38px_rgba(0,93,255,0.28)] sm:max-w-[360px] md:max-w-[460px]"
        draggable={false}
      />
    </section>
  );
}
