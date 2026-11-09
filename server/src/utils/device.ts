/** Turns a User-Agent into a short, friendly label like "Chrome on Android". Never throws. */
export function describeDevice(ua: string | undefined): string {
  if (!ua) return 'Unknown device';
  const os =
    /iPhone/i.test(ua) ? 'iPhone'
    : /iPad/i.test(ua) ? 'iPad'
    : /Android/i.test(ua) ? 'Android'
    : /Windows/i.test(ua) ? 'Windows'
    : /Mac OS X|Macintosh/i.test(ua) ? 'Mac'
    : /CrOS/i.test(ua) ? 'Chromebook'
    : /Linux/i.test(ua) ? 'Linux'
    : '';
  // Order matters: Edge, Opera and Samsung also say "Chrome"; Chrome also says "Safari".
  const browser =
    /EdgA?\/|Edg\//i.test(ua) ? 'Edge'
    : /OPR\/|Opera/i.test(ua) ? 'Opera'
    : /SamsungBrowser/i.test(ua) ? 'Samsung Internet'
    : /Firefox|FxiOS/i.test(ua) ? 'Firefox'
    : /Chrome|CriOS/i.test(ua) ? 'Chrome'
    : /Safari/i.test(ua) ? 'Safari'
    : '';
  if (browser && os) return `${browser} on ${os}`;
  return browser || os || 'Unknown device';
}
