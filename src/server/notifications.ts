import { db } from '../db/index.ts';
import { auditLogs, emailLogs } from '../db/schema.ts';

export async function recordEmailNotification(params: {
  recipientEmail: string;
  subject: string;
  eventType: string;
  payload?: Record<string, unknown>;
}) {
  try {
    await db.insert(emailLogs).values({
      recipientEmail: params.recipientEmail,
      subject: params.subject,
      eventType: params.eventType,
      status: 'sent',
      payload: params.payload ?? {},
    });
  } catch (error) {
    console.error('Failed to record email notification:', error);
  }
}

export async function recordAuditLog(params: {
  adminId?: number | null;
  adminEmail: string;
  action: string;
  resource: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}) {
  try {
    await db.insert(auditLogs).values({
      adminId: params.adminId ?? null,
      adminEmail: params.adminEmail,
      action: params.action,
      resource: params.resource,
      details: params.details ?? {},
      ipAddress: params.ipAddress ?? '',
    });
  } catch (error) {
    console.error('Failed to record audit log:', error);
  }
}
