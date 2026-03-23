/**
 * Notification Operations - Business logic for notification management
 */
import type { OperationResult, PaginationParams, PaginatedResult } from './index';

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  link?: string;
  read: boolean;
  timestamp: string;
  source?: string;
}

// In-memory notification store (would be DB in production)
const notifications = new Map<string, Notification>();

// Initialize with some sample notifications
notifications.set('welcome', {
  id: 'welcome',
  type: 'info',
  title: 'Welcome to SuperBotijo',
  message: 'Your AI agent dashboard is ready to use.',
  read: false,
  timestamp: new Date().toISOString(),
  source: 'system',
});

/**
 * Get all notifications
 */
export async function getNotifications(
  filters: { type?: string; read?: boolean } = {},
  pagination: PaginationParams = {}
): Promise<OperationResult<PaginatedResult<Notification>>> {
  try {
    let items = Array.from(notifications.values());

    // Apply filters
    if (filters.type) {
      items = items.filter(n => n.type === filters.type);
    }
    if (filters.read !== undefined) {
      items = items.filter(n => n.read === filters.read);
    }

    // Sort by timestamp descending
    items.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Paginate
    const page = pagination.page || 1;
    const limit = pagination.limit || 20;
    const start = (page - 1) * limit;

    return {
      success: true,
      data: {
        items: items.slice(start, start + limit),
        total: items.length,
        page,
        limit,
        hasMore: start + limit < items.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get notifications',
    };
  }
}

/**
 * Get notification by ID
 */
export async function getNotificationById(id: string): Promise<OperationResult<Notification>> {
  try {
    const notification = notifications.get(id);
    
    if (!notification) {
      return { success: false, error: 'Notification not found' };
    }

    return { success: true, data: notification };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get notification',
    };
  }
}

/**
 * Create a new notification
 */
export async function createNotification(
  type: Notification['type'],
  title: string,
  message: string,
  options: { link?: string; source?: string } = {}
): Promise<OperationResult<Notification>> {
  try {
    const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    
    const notification: Notification = {
      id,
      type,
      title,
      message,
      link: options.link,
      read: false,
      timestamp: new Date().toISOString(),
      source: options.source,
    };

    notifications.set(id, notification);

    return { success: true, data: notification };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create notification',
    };
  }
}

/**
 * Mark notification as read
 */
export async function markNotificationRead(id: string): Promise<OperationResult> {
  try {
    const notification = notifications.get(id);
    
    if (!notification) {
      return { success: false, error: 'Notification not found' };
    }

    notification.read = true;
    notifications.set(id, notification);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to mark as read',
    };
  }
}

/**
 * Mark notification as unread
 */
export async function markNotificationUnread(id: string): Promise<OperationResult> {
  try {
    const notification = notifications.get(id);
    
    if (!notification) {
      return { success: false, error: 'Notification not found' };
    }

    notification.read = false;
    notifications.set(id, notification);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to mark as unread',
    };
  }
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsRead(): Promise<OperationResult<{ count: number }>> {
  try {
    let count = 0;

    for (const [id, notification] of notifications) {
      if (!notification.read) {
        notification.read = true;
        notifications.set(id, notification);
        count++;
      }
    }

    return { success: true, data: { count } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to mark all as read',
    };
  }
}

/**
 * Delete a notification
 */
export async function deleteNotification(id: string): Promise<OperationResult> {
  try {
    if (!notifications.has(id)) {
      return { success: false, error: 'Notification not found' };
    }

    notifications.delete(id);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete notification',
    };
  }
}

/**
 * Clear all read notifications
 */
export async function clearReadNotifications(): Promise<OperationResult<{ count: number }>> {
  try {
    let count = 0;

    for (const [id, notification] of notifications) {
      if (notification.read) {
        notifications.delete(id);
        count++;
      }
    }

    return { success: true, data: { count } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to clear notifications',
    };
  }
}

/**
 * Get unread count
 */
export async function getUnreadCount(): Promise<OperationResult<{ count: number }>> {
  try {
    const count = Array.from(notifications.values()).filter(n => !n.read).length;
    return { success: true, data: { count } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get count',
    };
  }
}

/**
 * Helper to create common notification types
 */
export const notify = {
  info: (title: string, message: string, link?: string) =>
    createNotification('info', title, message, { link }),
  
  success: (title: string, message: string, link?: string) =>
    createNotification('success', title, message, { link }),
  
  warning: (title: string, message: string, link?: string) =>
    createNotification('warning', title, message, { link }),
  
  error: (title: string, message: string, link?: string) =>
    createNotification('error', title, message, { link }),
  
  cronComplete: (jobName: string, success: boolean) =>
    createNotification(
      success ? 'success' : 'error',
      `Cron: ${jobName}`,
      success ? 'Job completed successfully' : 'Job failed',
      { source: 'cron' }
    ),
  
  agentEvent: (agentId: string, event: string) =>
    createNotification('info', `Agent: ${agentId}`, event, { source: 'agent' }),
};
