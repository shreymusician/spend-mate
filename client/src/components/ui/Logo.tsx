import logo from '@/assets/logo.svg';

/**
 * App mark: many hands of different sizes, like a whole family, resting together on one pack of money.
 * The picture is an SVG file (src/assets/logo.svg), small enough to be built right into the page.
 */
export function Logo({ size = 64 }: { size?: number }) {
  return (
    <img
      src={logo}
      alt=""
      aria-hidden
      width={size}
      height={size}
      draggable={false}
      className="block shrink-0 select-none"
      style={{ width: size, height: size, borderRadius: size * 0.27, boxShadow: '0 12px 26px -12px rgba(10,150,120,0.75)' }}
    />
  );
}
