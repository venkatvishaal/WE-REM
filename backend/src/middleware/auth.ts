import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { dbGet } from '../db/database';

declare global {
  namespace Express {
    interface Request { userId?: string }
  }
}

const SESSION_COOKIE = 'session';
const SESSION_DAYS = 30;
const secure = () => process.env.NODE_ENV === 'production';

function sessionSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('Set SESSION_SECRET (at least 32 random characters) in .env');
  return s;
}

export function readCookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.cookie || '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

export function setCookie(res: Response, name: string, value: string, maxAgeMs: number): void {
  // Lax keeps the cookie on the redirect back from Google; HttpOnly keeps it away from page scripts
  res.cookie(name, value, { httpOnly: true, sameSite: 'lax', secure: secure(), maxAge: maxAgeMs, path: '/' });
}

export function startSession(res: Response, userId: string): void {
  const token = jwt.sign({ sub: userId }, sessionSecret(), { expiresIn: `${SESSION_DAYS}d` });
  setCookie(res, SESSION_COOKIE, token, SESSION_DAYS * 24 * 3600 * 1000);
}

export function endSession(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

/** Sets req.userId from the session cookie, or answers 401. The user must still exist (deleted accounts lose access at once). */
export async function requireUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = readCookie(req, SESSION_COOKIE);
  try {
    const { sub } = jwt.verify(token || '', sessionSecret()) as { sub: string };
    const user = await dbGet<{ id: string }>('SELECT id FROM users WHERE id = ?', [sub]);
    if (!user) throw new Error('unknown user');
    req.userId = user.id;
    next();
  } catch {
    res.status(401).json({ error: 'Not signed in' });
  }
}

/** Route handlers run after requireUser, so userId is always set. */
export const uid = (req: Request): string => req.userId as string;

/** Express 4 ignores rejected promises; this passes async route errors to the error handler. */
export const ah = (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => { fn(req, res, next).catch(next); };
