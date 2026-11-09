/** A person's photo, or their initials on the brand gradient when they haven't added one. */
export function Avatar({ name, size = 44, src }: { name: string; size?: number; src?: string | null }) {
  const style = { width: size, height: size };
  if (src) return <img src={src} alt="" aria-hidden width={size} height={size} className="shrink-0 rounded-full object-cover shadow-[0_0_0_1px_rgba(0,0,0,0.06)]" style={style} />;
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
  return (
    <span aria-hidden className="brand-gradient grid shrink-0 place-items-center rounded-full font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]" style={{ ...style, fontSize: size * 0.38 }}>
      {initials}
    </span>
  );
}
