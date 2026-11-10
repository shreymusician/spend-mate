import { useRef, type TouchEvent } from 'react';

const MIN_DISTANCE = 60; // how far the finger must travel sideways, in px
const MIN_RATIO = 1.6;   // sideways travel must clearly beat up/down travel, so scrolling is never mistaken for a swipe
const MAX_MS = 800;      // a quick flick, not a slow drag or a long press

/** Things a sideways swipe must leave alone: open sheets, text fields, sliders, and areas that scroll sideways. */
function swipeIsBlocked(target: EventTarget | null, stopAt: HTMLElement): boolean {
  if (document.querySelector('[role="dialog"][aria-modal="true"]')) return true;
  for (let el = target as HTMLElement | null; el && el !== stopAt; el = el.parentElement) {
    if (el.matches?.('input, textarea, select, [contenteditable="true"], [role="slider"], [data-no-swipe]')) return true;
    const { overflowX } = getComputedStyle(el);
    if ((overflowX === 'auto' || overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 1) return true;
  }
  return false;
}

/**
 * Swipe sideways to move between tabs. Right to left goes to the next tab, left to right to the previous one.
 * Spread the returned handlers on the element that holds the page.
 */
export function useTabSwipe(onSwipe: (direction: 'next' | 'previous') => void, enabled = true) {
  const start = useRef<{ x: number; y: number; at: number } | null>(null);

  return {
    onTouchStart(e: TouchEvent<HTMLElement>) {
      start.current = null;
      if (!enabled || e.touches.length !== 1) return; // pinch and two-finger gestures are not swipes
      if (swipeIsBlocked(e.target, e.currentTarget)) return;
      const t = e.touches[0]!;
      start.current = { x: t.clientX, y: t.clientY, at: Date.now() };
    },
    onTouchEnd(e: TouchEvent<HTMLElement>) {
      const s = start.current;
      start.current = null;
      const t = e.changedTouches[0];
      if (!s || !t) return;
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      if (Date.now() - s.at > MAX_MS) return;
      if (Math.abs(dx) < MIN_DISTANCE || Math.abs(dx) < Math.abs(dy) * MIN_RATIO) return;
      onSwipe(dx < 0 ? 'next' : 'previous');
    },
    onTouchCancel() { start.current = null; },
  };
}
