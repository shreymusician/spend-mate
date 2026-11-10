import bcrypt from 'bcryptjs';
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import { signAccessToken } from '../../middleware/auth.js';
import { disconnectUser } from '../../realtime/hub.js';
import { describeDevice } from '../../utils/device.js';
import { badRequest, conflict, forbidden, HttpError, unauthorized } from '../../utils/errors.js';
import { audit } from '../audit/audit.model.js';
import { User, ageInYears, publicUser } from '../users/user.model.js';
import { RefreshToken } from './refreshToken.model.js';

const MIN_AGE = 13;
const BCRYPT_COST = 12;
const MAX_WRONG_PINS = 5;
const LOCK_MS = 15 * 60_000;

// A 4-digit pin has only 10,000 possibilities, so: it is hashed with a server-side secret
// (a stolen database alone can't be brute-forced), and wrong tries lock the account for a while.
const pinSecret = (mobile: string, pin: string) => createHmac('sha256', env.PIN_PEPPER).update(`${mobile}:${pin}`).digest('base64');
const hashPin = (mobile: string, pin: string) => bcrypt.hash(pinSecret(mobile, pin), BCRYPT_COST);

// Compared against when the mobile number is unknown, so timing doesn't reveal which numbers exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-pin', BCRYPT_COST);

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

const SHORT_SESSION_MS = 24 * 3_600_000; // when "Remember me" is off

interface DeviceInfo { remember: boolean; deviceLabel: string }

async function issueRefresh(userId: string, family: string, userAgent: string | undefined, d: DeviceInfo) {
  const raw = randomBytes(32).toString('base64url');
  const ttl = d.remember ? env.REFRESH_TOKEN_TTL_DAYS * 86_400_000 : SHORT_SESSION_MS;
  await RefreshToken.create({
    user: userId,
    tokenHash: sha256(raw),
    family,
    expiresAt: new Date(Date.now() + ttl),
    userAgent: userAgent?.slice(0, 300),
    remember: d.remember,
    deviceLabel: d.deviceLabel,
  });
  return raw;
}

async function session(user: Parameters<typeof publicUser>[0], family: string, userAgent: string | undefined, d: DeviceInfo) {
  return {
    accessToken: signAccessToken(String(user._id)),
    refreshToken: await issueRefresh(String(user._id), family, userAgent, d),
    remember: d.remember,
    user: publicUser(user),
    device: { label: d.deviceLabel, remembered: d.remember },
  };
}

const deviceFor = (remember: boolean, ua?: string): DeviceInfo => ({ remember, deviceLabel: describeDevice(ua) });

export async function register(input: { name: string; gender: (typeof import('../users/user.model.js').GENDERS)[number]; dob: Date; mobile: string; pin: string; theme?: 'light' | 'dark'; remember?: boolean; avatar?: string }, ua?: string) {
  if (ageInYears(input.dob) < MIN_AGE) throw badRequest(`SpendMate is for ages ${MIN_AGE} and up`);
  if (await User.exists({ mobile: input.mobile })) throw conflict('An account with this mobile number already exists');
  const user = await User.create({
    name: input.name,
    gender: input.gender,
    dob: input.dob,
    mobile: input.mobile,
    ...(input.avatar && { avatarUrl: input.avatar }),
    ...(input.theme && { prefs: { theme: input.theme } }),
    pinHash: await hashPin(input.mobile, input.pin),
  });
  return session(user, randomUUID(), ua, deviceFor(input.remember ?? true, ua));
}

function assertNotLocked(user: { lockedUntil?: Date | null } | null) {
  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
    throw new HttpError(429, `Too many wrong tries. Please wait ${mins} minute${mins === 1 ? '' : 's'} and try again.`, 'locked');
  }
}

/** Counts a failed attempt (login or reset share one counter) and locks the account after too many. */
async function recordFailure(userId: unknown) {
  const updated = await User.findOneAndUpdate({ _id: userId }, { $inc: { failedPinAttempts: 1 } }, { returnDocument: 'after' }).select('+failedPinAttempts');
  if (updated && (updated.failedPinAttempts ?? 0) >= MAX_WRONG_PINS) {
    await User.updateOne({ _id: userId }, { failedPinAttempts: 0, lockedUntil: new Date(Date.now() + LOCK_MS) });
  }
}

/** Whether an account exists for this (already validated) mobile number. */
export async function mobileExists(mobile: string): Promise<boolean> {
  return !!(await User.exists({ mobile }));
}

/**
 * Asks a signed-in person for their Secret Pin again before something that can't be undone. Wrong tries count toward
 * the same lock-out as signing in. A wrong Pin answers 403 (not 401), so the app does not think the session ended.
 */
export async function confirmPin(userId: string, pin: string) {
  const user = await User.findById(userId).select('+pinHash +failedPinAttempts +lockedUntil');
  if (!user) throw unauthorized();
  assertNotLocked(user);
  const ok = await bcrypt.compare(pinSecret(user.mobile, pin), user.pinHash);
  if (!ok) {
    await recordFailure(user._id);
    throw forbidden('That isn’t your Secret Pin.');
  }
  if (user.failedPinAttempts || user.lockedUntil) await User.updateOne({ _id: user._id }, { failedPinAttempts: 0, $unset: { lockedUntil: 1 } });
}

export async function login(input: { mobile: string; pin: string; remember?: boolean }, ua?: string) {
  const user = await User.findOne({ mobile: input.mobile }).select('+pinHash +failedPinAttempts +lockedUntil');
  assertNotLocked(user);

  const ok = await bcrypt.compare(pinSecret(input.mobile, input.pin), user?.pinHash ?? DUMMY_HASH);
  if (!user || !ok) {
    if (user) await recordFailure(user._id);
    throw unauthorized('Wrong mobile number or Secret Pin');
  }

  if (user.failedPinAttempts || user.lockedUntil) await User.updateOne({ _id: user._id }, { failedPinAttempts: 0, $unset: { lockedUntil: 1 } });
  return session(user, randomUUID(), ua, deviceFor(input.remember ?? true, ua));
}

/**
 * Forgot Secret Pin: proves identity with the date of birth. The same lockout as sign-in applies, and the
 * error is identical whether the mobile number exists or not. Every signed-in device is signed out afterwards.
 */
export async function resetPin(input: { mobile: string; dob: string; pin: string }) {
  const user = await User.findOne({ mobile: input.mobile }).select('+failedPinAttempts +lockedUntil');
  assertNotLocked(user);

  const matches = !!user && user.dob.toISOString().slice(0, 10) === input.dob;
  if (!matches) {
    // Same cost as a real attempt so timing doesn't reveal whether the number exists.
    await bcrypt.compare('x', DUMMY_HASH);
    if (user) await recordFailure(user._id);
    throw badRequest('Those details don’t match our records.');
  }

  await User.updateOne({ _id: user._id }, { pinHash: await hashPin(input.mobile, input.pin), failedPinAttempts: 0, $unset: { lockedUntil: 1 } });
  await RefreshToken.updateMany({ user: user._id, revokedAt: null }, { revokedAt: new Date() });
  disconnectUser(String(user._id)); // every signed-in device is signed out, including its live connection
  await audit(String(user._id), 'user', user._id, 'update', undefined, { pinReset: true });
}

/** Rotates the refresh token. Re-using a rotated token revokes the entire family. */
export async function refresh(raw: string | undefined, ua?: string) {
  if (!raw) throw unauthorized();
  const row = await RefreshToken.findOne({ tokenHash: sha256(raw) });
  if (!row) throw unauthorized();
  if (row.revokedAt) {
    await RefreshToken.updateMany({ family: row.family, revokedAt: null }, { revokedAt: new Date() });
    throw unauthorized('Session was reused — please sign in again');
  }
  if (row.expiresAt < new Date()) throw unauthorized();

  // Atomic claim: only one concurrent request can revoke this token.
  const claimed = await RefreshToken.findOneAndUpdate({ _id: row._id, revokedAt: null }, { revokedAt: new Date() });
  if (!claimed) throw unauthorized();

  const user = await User.findById(row.user);
  if (!user) throw unauthorized();
  // Rotation keeps the person's "Remember me" choice; the device label is refreshed from this request.
  return session(user, row.family, ua, { remember: row.remember ?? true, deviceLabel: ua ? describeDevice(ua) : (row.deviceLabel ?? 'Unknown device') });
}

export async function logout(raw: string | undefined) {
  if (!raw) return;
  const row = await RefreshToken.findOne({ tokenHash: sha256(raw) });
  if (row) await RefreshToken.updateMany({ family: row.family, revokedAt: null }, { revokedAt: new Date() });
}
