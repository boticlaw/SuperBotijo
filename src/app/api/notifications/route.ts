import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { rateLimiter } from '@/lib/rate-limiter';

export const dynamic = "force-dynamic";

const DATA_PATH = path.join(process.cwd(), 'data', 'notifications.json');

export interface Notification {
  id: string;
  timestamp: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  link?: string;
  metadata?: Record<string, unknown>;
}

interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}

async function loadNotifications(): Promise<Notification[]> {
  try {
    const data = await fs.readFile(DATA_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function saveNotifications(notifications: Notification[]): Promise<void> {
  const dir = path.dirname(DATA_PATH);
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
  await fs.writeFile(DATA_PATH, JSON.stringify(notifications, null, 2));
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const onlyUnread = searchParams.get('unread') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');

    let notifications = await loadNotifications();

    // Filter by read status if requested
    if (onlyUnread) {
      notifications = notifications.filter((n) => !n.read);
    }

    // Sort by timestamp (newest first)
    notifications.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Apply limit
    notifications = notifications.slice(0, limit);

    const unreadCount = (await loadNotifications()).filter((n) => !n.read).length;

    return NextResponse.json<NotificationsResponse>({
      notifications,
      unreadCount,
    });
  } catch (error) {
    console.error('Failed to get notifications:', error);
    return NextResponse.json({ error: 'Failed to get notifications' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';

  const { allowed, remaining, resetIn } = rateLimiter.isAllowed(clientIp);

  if (!allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter: resetIn },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(resetIn / 1000)),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Limit': '10',
        },
      }
    );
  }

  try {
    const body = await request.json();

    // Validate required fields
    if (!body.title || !body.message) {
      return NextResponse.json(
        { error: 'Missing required fields: title, message' },
        { status: 400 }
      );
    }

    // Validate type
    const validTypes = ['info', 'success', 'warning', 'error'];
    const type = body.type || 'info';
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const notifications = await loadNotifications();

    const newNotification: Notification = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      title: body.title,
      message: body.message,
      type,
      read: false,
      link: body.link,
      metadata: body.metadata,
    };

    // Prepend (newest first)
    notifications.unshift(newNotification);

    // Keep only last 100 notifications
    if (notifications.length > 100) {
      notifications.splice(100);
    }

    await saveNotifications(notifications);

    return NextResponse.json(newNotification, {
      status: 201,
      headers: {
        'X-RateLimit-Remaining': String(remaining),
        'X-RateLimit-Limit': '10',
      },
    });
  } catch (error) {
    console.error('Failed to create notification:', error);
    return NextResponse.json({ error: 'Failed to create notification' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, read, action } = body;

    const notifications = await loadNotifications();

    // Mark all as read
    if (action === 'markAllRead') {
      notifications.forEach((n) => (n.read = true));
      await saveNotifications(notifications);
      return NextResponse.json({ success: true, updated: notifications.length });
    }

    // Mark single notification as read/unread
    if (id) {
      const notification = notifications.find((n) => n.id === id);
      if (!notification) {
        return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
      }

      notification.read = read !== undefined ? read : !notification.read;
      await saveNotifications(notifications);
      return NextResponse.json(notification);
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    console.error('Failed to update notification:', error);
    return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const action = searchParams.get('action');

    const notifications = await loadNotifications();

    // Delete all read notifications
    if (action === 'clearRead') {
      const updated = notifications.filter((n) => !n.read);
      await saveNotifications(updated);
      return NextResponse.json({ success: true, deleted: notifications.length - updated.length });
    }

    // Delete single notification
    if (id) {
      const index = notifications.findIndex((n) => n.id === id);
      if (index === -1) {
        return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
      }

      notifications.splice(index, 1);
      await saveNotifications(notifications);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    console.error('Failed to delete notification:', error);
    return NextResponse.json({ error: 'Failed to delete notification' }, { status: 500 });
  }
}
