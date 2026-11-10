import { motion, useReducedMotion } from 'framer-motion';
import { EyeOff, Lock } from 'lucide-react';
import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { Sheet } from '@/components/ui/Sheet';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { GENERATION_LABEL, generationOf, PEER_ORDER } from '@/lib/relations';
import { formatPaise } from '@/lib/utils';
import type { FamilyLink } from '@/types';

/** One relative, with both directions of the connection in one place. */
interface Member {
  id: string;
  name: string;
  avatarUrl: string | null;
  kind: string;
  relation: string;
  /** They can see what I share (and whether I have paused that). */
  viewsMe: FamilyLink | null;
  /** I can see what they share (and whether they have paused that). */
  iView: FamilyLink | null;
}

interface Placed { member: Member | null; x: number; y: number; size: number } // member null = you

const PAD_X = 34;
const ROW_H = 142;
const PAD_TOP = 62;
const ME = 76;
const AMBER = '#ffc46b';
const MINT = '#0fa37f';

/** Merges the two connection lists into one person each. */
function membersOf(sharingWith: FamilyLink[], following: FamilyLink[]): Member[] {
  const byId = new Map<string, Member>();
  for (const l of [...sharingWith, ...following]) {
    const m = byId.get(l.user.id) ?? { id: l.user.id, name: l.user.name, avatarUrl: l.user.avatarUrl, kind: l.kind, relation: l.relation, viewsMe: null, iView: null };
    if (sharingWith.includes(l)) m.viewsMe = l; else m.iView = l;
    byId.set(l.user.id, m);
  }
  return [...byId.values()];
}

/** Rows from oldest to youngest generation, each row's people placed left to right. You are always in the middle row. */
function layout(members: Member[], width: number): { placed: Placed[]; rows: number[]; height: number } {
  const gens = [...new Set([0, ...members.map((m) => generationOf(m.kind))])].sort((a, b) => a - b);
  const placed: Placed[] = [];
  gens.forEach((g, rowIndex) => {
    const row: (Member | null)[] = members.filter((m) => generationOf(m.kind) === g);
    row.sort((a, b) => (PEER_ORDER[a!.kind] ?? 1) - (PEER_ORDER[b!.kind] ?? 1) || a!.name.localeCompare(b!.name));
    if (g === 0) {
      // siblings on your left, then you, then spouse, cousins and others on your right
      const at = row.findIndex((m) => (PEER_ORDER[m!.kind] ?? 1) > 1);
      row.splice(at === -1 ? row.length : at, 0, null);
    }
    const n = row.length;
    const size = n > 7 ? 42 : n > 5 ? 48 : 56;
    const room = width - PAD_X * 2;
    const span = n === 1 ? 0 : Math.min(room, (n - 1) * 92);
    const start = width / 2 - span / 2;
    row.forEach((m, i) => placed.push({ member: m, x: n === 1 ? width / 2 : start + (i * span) / (n - 1), y: PAD_TOP + rowIndex * ROW_H, size: m === null ? ME : size }));
  });
  return { placed, rows: gens, height: PAD_TOP + (gens.length - 1) * ROW_H + 104 };
}

/** The line joining you to someone: a smooth S-curve between generations, a straight bar between people of the same one. */
function linkPath(a: Placed, b: Placed): string {
  if (a.y === b.y) return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  const mid = (a.y + b.y) / 2;
  return `M ${a.x} ${a.y} C ${a.x} ${mid}, ${b.x} ${mid}, ${b.x} ${b.y}`;
}

/**
 * Your family as a tree, oldest generation at the top. Everyone is their profile photo. Lines join you to each person
 * and glow with little lights moving along them: amber for your entries going to them, green for theirs coming to you.
 * A dashed line means no one can see anything on that connection. Tap someone you can see to open their spending.
 */
export function FamilyTree({ spent }: { spent: Record<string, number> }) {
  const { user } = useAuth();
  const { family } = useData();
  const nav = useNavigate();
  const reduced = useReducedMotion();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const holder = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(326);
  const [info, setInfo] = useState<Member | null>(null);

  useLayoutEffect(() => {
    const el = holder.current;
    if (!el) return;
    setWidth(Math.round(el.getBoundingClientRect().width) || 326);
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e!.contentRect.width) || 326));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const members = useMemo(() => membersOf(family.sharingWith, family.following), [family]);
  const { placed, rows, height } = useMemo(() => layout(members, width), [members, width]);
  const me = placed.find((p) => p.member === null)!;
  const others = placed.filter((p) => p.member !== null);
  if (!user) return null;

  function open(m: Member) {
    if (m.iView && !m.iView.paused) nav(`/family/${m.id}`);
    else setInfo(m);
  }

  const first = (n: string) => n.split(' ')[0]!;

  return (
    <div>
      <CardTitle>Family tree</CardTitle>
      <Card className="relative overflow-hidden p-0">
        {/* soft moving colour behind the tree */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <motion.div className="absolute -left-16 -top-10 h-56 w-56 rounded-full bg-[#34e3b0]/25 blur-3xl" animate={reduced ? undefined : { x: [0, 30, 0], y: [0, 20, 0] }} transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }} />
          <motion.div className="absolute -bottom-16 -right-12 h-56 w-56 rounded-full bg-[#ffc46b]/20 blur-3xl" animate={reduced ? undefined : { x: [0, -26, 0], y: [0, -18, 0] }} transition={{ duration: 13, repeat: Infinity, ease: 'easeInOut' }} />
        </div>

        <div ref={holder} className="relative mx-auto w-full" style={{ height }}>
          {/* generation labels */}
          {rows.map((g, i) => (
            <motion.p key={g} className="font-hand absolute left-3.5 text-[18px] font-semibold text-muted" style={{ top: PAD_TOP + i * ROW_H - ME / 2 - 24 }}
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.1 }}>
              {GENERATION_LABEL[g]}
            </motion.p>
          ))}

          {/* the lines */}
          <svg aria-hidden className="pointer-events-none absolute inset-0" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
            {others.map((o, i) => {
              const m = o.member!;
              const d = linkPath(me, o);
              const id = `${uid}-${m.id}`;
              const toThem = !!m.viewsMe && !m.viewsMe.paused;   // my entries reach them
              const toMe = !!m.iView && !m.iView.paused;         // their entries reach me
              const live = toThem || toMe;
              return (
                <g key={m.id}>
                  <path id={id} d={d} fill="none" stroke="transparent" />
                  {live ? (
                    <motion.path d={d} fill="none" stroke={MINT} strokeOpacity={0.5} strokeWidth={3} strokeLinecap="round"
                      initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, delay: 0.35 + i * 0.1, ease: 'easeInOut' }} />
                  ) : (
                    <motion.path d={d} fill="none" stroke="currentColor" strokeOpacity={0.35} strokeWidth={2} strokeDasharray="5 7" strokeLinecap="round" className="text-muted"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.35 + i * 0.1 }} />
                  )}
                  {!reduced && toThem && (
                    <circle r="4.5" fill={AMBER} stroke="#fff" strokeWidth="1.2">
                      <animateMotion dur={`${2.4 + (i % 3) * 0.4}s`} repeatCount="indefinite" begin={`${0.9 + i * 0.25}s`}><mpath href={`#${id}`} /></animateMotion>
                    </circle>
                  )}
                  {!reduced && toMe && (
                    <circle r="4.5" fill="#34e3b0" stroke="#fff" strokeWidth="1.2">
                      <animateMotion dur={`${2.6 + (i % 3) * 0.4}s`} repeatCount="indefinite" begin={`${1.2 + i * 0.25}s`} keyPoints="1;0" keyTimes="0;1" calcMode="linear"><mpath href={`#${id}`} /></animateMotion>
                    </circle>
                  )}
                </g>
              );
            })}
          </svg>

          {/* you */}
          <motion.button
            type="button"
            onClick={() => nav('/profile')}
            aria-label="You. Open your profile."
            className="absolute rounded-full"
            style={{ left: me.x - ME / 2, top: me.y - ME / 2, width: ME, height: ME }}
            initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} whileTap={{ scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 240, damping: 15, delay: 0.1 }}
          >
            {!reduced && [0, 1].map((k) => (
              <motion.span key={k} aria-hidden className="absolute inset-0 rounded-full border-2 border-[#0fa37f]"
                animate={{ scale: [1, 1.55], opacity: [0.55, 0] }} transition={{ duration: 2.6, repeat: Infinity, delay: k * 1.3, ease: 'easeOut' }} />
            ))}
            <span className="brand-gradient relative block rounded-full p-[3px] shadow-[0_10px_26px_-8px_rgba(10,150,120,0.8)]">
              <span className="block rounded-full border-[3px] border-surface dark:border-surface-2"><Avatar name={user.name} src={user.avatarUrl} size={ME - 12} /></span>
            </span>
            <span className="pointer-events-none absolute left-1/2 top-full mt-1.5 w-24 -translate-x-1/2 text-center text-[14px] font-extrabold leading-tight">You</span>
          </motion.button>

          {/* everyone else */}
          {others.map((o, i) => {
            const m = o.member!;
            const canOpen = !!m.iView && !m.iView.paused;
            const gap = 0.3 + (rows.indexOf(generationOf(m.kind)) + 1) * 0.12 + i * 0.05;
            return (
              <motion.button
                key={m.id}
                type="button"
                onClick={() => open(m)}
                aria-label={`${m.name}, your ${m.relation}. ${canOpen ? 'Open their spending.' : 'See details.'}`}
                className="absolute rounded-full"
                style={{ left: o.x - o.size / 2, top: o.y - o.size / 2, width: o.size, height: o.size }}
                initial={{ scale: 0, opacity: 0, y: 14 }} animate={{ scale: 1, opacity: 1, y: 0 }} whileTap={{ scale: 0.92 }}
                transition={{ type: 'spring', stiffness: 260, damping: 16, delay: gap }}
              >
                <motion.span className="block" animate={reduced ? undefined : { y: [0, -3.5, 0] }} transition={{ duration: 3.4 + (i % 4) * 0.5, repeat: Infinity, ease: 'easeInOut', delay: i * 0.3 }}>
                  <span className={`block rounded-full p-[2.5px] shadow-[0_8px_20px_-8px_rgba(0,0,0,0.45)] ${canOpen ? 'brand-gradient' : 'bg-muted/40'}`}>
                    <span className="block rounded-full border-2 border-surface dark:border-surface-2"><Avatar name={m.name} src={m.avatarUrl} size={o.size - 9} /></span>
                  </span>
                </motion.span>
                {(m.viewsMe?.paused || m.iView?.paused) && (
                  <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-surface text-muted shadow ring-1 ring-line dark:bg-surface-2">
                    {m.viewsMe?.paused ? <Lock size={11} aria-label="You have paused their access" /> : <EyeOff size={11} aria-label="They have paused theirs" />}
                  </span>
                )}
                <span className="pointer-events-none absolute left-1/2 top-full mt-1.5 w-[92px] -translate-x-1/2 text-center">
                  <span className="block truncate text-[13px] font-bold leading-tight">{first(m.name)}</span>
                  <span className="block truncate text-[12px] font-semibold leading-tight text-accent">{m.relation}</span>
                  {spent[m.id] !== undefined && canOpen && <span className="block truncate text-[11px] leading-tight text-muted">{formatPaise(spent[m.id]!)} spent</span>}
                </span>
              </motion.button>
            );
          })}

          {others.length === 0 && (
            <motion.p className="absolute inset-x-8 text-center text-[15px] text-muted" style={{ top: me.y + ME / 2 + 36 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
              Connect with a family member above and your tree will grow here.
            </motion.p>
          )}
        </div>

        {others.length > 0 && (
          <div className="relative space-y-1.5 border-t border-line px-4 py-3 text-[12.5px] text-muted">
            <p className="text-[13px] font-semibold text-fg">Tap a person to see their spending.</p>
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: AMBER }} />Your entries go to them</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#34e3b0]" />Their entries come to you</span>
              <span className="inline-flex items-center gap-1.5"><span className="inline-block w-4 border-t-2 border-dashed border-muted/60" />Nothing shared right now</span>
            </p>
          </div>
        )}
      </Card>

      <Sheet open={!!info} onClose={() => setInfo(null)} title={info ? info.name : ''}>
        {info && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar name={info.name} src={info.avatarUrl} size={64} />
              <div className="min-w-0">
                <p className="truncate text-[20px] font-bold tracking-[-0.02em]">{info.name}</p>
                <p className="font-semibold text-accent">Your {info.relation}</p>
              </div>
            </div>
            <div className="space-y-2 rounded-2xl bg-surface-2 px-4 py-3 text-[15px] leading-snug">
              {info.iView?.paused
                ? <p>{first(info.name)} has paused sharing with you. You’ll see their spending again when they switch it back on.</p>
                : <p>{first(info.name)} doesn’t share their spending with you, so there is nothing to show here.</p>}
              {info.viewsMe && (
                <p className="text-muted">{info.viewsMe.paused ? `You have paused ${first(info.name)}’s access to your entries.` : `${first(info.name)} can see the entries you share.`} You can change that under Access below.</p>
              )}
            </div>
            <Button variant="secondary" block onClick={() => setInfo(null)}>Close</Button>
          </div>
        )}
      </Sheet>
    </div>
  );
}
