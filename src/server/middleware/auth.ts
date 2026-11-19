import { NextFunction, Request, Response } from 'express';
import { and, eq, gt } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { adminSessions, adminUsers, users } from '../../db/schema.ts';
import { adminAuth } from '../../lib/firebase-admin.ts';
import { hashToken, verifyCustomerToken } from '../crypto.ts';

export interface CustomerContext {
  id: number;
  uid: string | null;
  email: string;
  fullName: string;
  phone: string;
  isSuspended: boolean;
}

export interface AdminContext {
  id: number;
  email: string;
  username: string;
  fullName: string;
  role: 'super_admin' | 'store_manager' | 'content_manager';
  sessionId: number;
}

export interface AppRequest extends Request {
  customer?: CustomerContext;
  admin?: AdminContext;
}

async function resolveCustomerFromToken(token: string): Promise<CustomerContext | null> {
  if (!token) return null;

  // 1. Check first-party customer signed token
  if (token.startsWith('ds_')) {
    const payload = verifyCustomerToken(token);
    if (!payload) return null;
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);
    const u = rows[0];
    if (!u || u.isSuspended) return null;
    return {
      id: u.id,
      uid: u.uid,
      email: u.email,
      fullName: u.fullName,
      phone: u.phone,
      isSuspended: u.isSuspended,
    };
  }

  // 2. Verify Firebase ID Token (Google Sign-In)
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const email = decoded.email || `${decoded.uid}@firebase.user`;
    const fullName = decoded.name || '';
    const existingByUid = await db
      .select()
      .from(users)
      .where(eq(users.uid, decoded.uid))
      .limit(1);

    if (existingByUid[0]) {
      if (existingByUid[0].isSuspended) return null;
      return {
        id: existingByUid[0].id,
        uid: existingByUid[0].uid,
        email: existingByUid[0].email,
        fullName: existingByUid[0].fullName,
        phone: existingByUid[0].phone,
        isSuspended: existingByUid[0].isSuspended,
      };
    }

    // Upsert by email or uid safely
    const upserted = await db
      .insert(users)
      .values({
        uid: decoded.uid,
        email,
        fullName,
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          uid: decoded.uid,
          updatedAt: new Date(),
        },
      })
      .returning();

    const u = upserted[0];
    if (!u || u.isSuspended) return null;
    return {
      id: u.id,
      uid: u.uid,
      email: u.email,
      fullName: u.fullName,
      phone: u.phone,
      isSuspended: u.isSuspended,
    };
  } catch {
    return null;
  }
}

export async function optionalCustomerAuth(
  req: AppRequest,
  _res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      const customer = await resolveCustomerFromToken(token);
      if (customer) {
        req.customer = customer;
      }
    }
  } catch {
    // Ignore optional auth failures
  }
  next();
}

export async function requireCustomerAuth(
  req: AppRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  const token = authHeader.slice(7).trim();
  try {
    const customer = await resolveCustomerFromToken(token);
    if (!customer) {
      return res.status(401).json({ error: 'Invalid or suspended customer session.' });
    }
    req.customer = customer;
    next();
  } catch (error) {
    console.error('Customer auth error:', error);
    return res.status(401).json({ error: 'Authentication failed.' });
  }
}

export async function requireAdminAuth(
  req: AppRequest,
  res: Response,
  next: NextFunction
) {
  const headerToken = req.headers['x-admin-token'] as string | undefined;
  const authHeader = req.headers.authorization;
  const rawToken =
    headerToken ||
    (authHeader && authHeader.startsWith('AdminBearer ')
      ? authHeader.slice('AdminBearer '.length).trim()
      : undefined);

  if (!rawToken) {
    return res.status(401).json({ error: 'Administrator authentication required.' });
  }

  try {
    const tokenHash = hashToken(rawToken);
    const rows = await db
      .select({
        sessionId: adminSessions.id,
        expiresAt: adminSessions.expiresAt,
        adminId: adminUsers.id,
        email: adminUsers.email,
        username: adminUsers.username,
        fullName: adminUsers.fullName,
        role: adminUsers.role,
        isActive: adminUsers.isActive,
      })
      .from(adminSessions)
      .innerJoin(adminUsers, eq(adminSessions.adminId, adminUsers.id))
      .where(
        and(
          eq(adminSessions.tokenHash, tokenHash),
          gt(adminSessions.expiresAt, new Date())
        )
      )
      .limit(1);

    const record = rows[0];
    if (!record || !record.isActive) {
      return res.status(401).json({ error: 'Administrator session expired or inactive.' });
    }

    req.admin = {
      id: record.adminId,
      email: record.email,
      username: record.username,
      fullName: record.fullName,
      role: record.role as AdminContext['role'],
      sessionId: record.sessionId,
    };
    next();
  } catch (error) {
    console.error('Admin auth verification failed:', error);
    return res.status(500).json({ error: 'Unable to verify administrator session.' });
  }
}

export function requireAdminRole(...allowedRoles: AdminContext['role'][]) {
  return (req: AppRequest, res: Response, next: NextFunction) => {
    if (!req.admin) {
      return res.status(401).json({ error: 'Administrator authentication required.' });
    }
    if (!allowedRoles.includes(req.admin.role)) {
      return res.status(403).json({
        error: `Access denied. Requires role: ${allowedRoles.join(' or ')}.`,
      });
    }
    next();
  };
}
