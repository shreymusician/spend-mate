/** App mark: a gradient squircle with a coin-like ₹ and a soft top highlight. */
export function Logo({ size = 64 }: { size?: number }) {
  return (
    <div
      aria-hidden
      className="brand-gradient relative grid place-items-center overflow-hidden text-white shadow-[0_14px_30px_-10px_rgba(10,150,120,0.75),inset_0_1px_0_rgba(255,255,255,0.5)]"
      style={{ width: size, height: size, borderRadius: size * 0.3 }}
    >
      <span className="absolute -top-1/2 left-0 right-0 h-full rounded-full bg-white/25 blur-md" />
      <span className="relative font-bold" style={{ fontSize: size * 0.52, lineHeight: 1 }}>₹</span>
    </div>
  );
}
