/** Clip decoration only; navigation menus and interactive content stay unclipped. */
export function StorefrontAmbientGlow() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="glow-radial absolute left-[10%] top-[5%] h-[500px] w-[500px] rounded-full opacity-30" />
    </div>
  );
}
