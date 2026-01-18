'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Bell, Clock, CheckCircle, XCircle, Trash2, Mail, Smartphone, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { format, formatDistanceToNow, differenceInHours, isPast } from 'date-fns';
import { NOTIFY_VIA_OPTIONS, type NotifyVia } from '@/lib/constants';

interface Reminder {
  id: string;
  message: string;
  remindAt: string | null;
  notifyVia: NotifyVia;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface RemindersResponse {
  reminders: Reminder[];
  total: number;
  page: number;
  totalPages: number;
}

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock size={16} className="text-yellow-500" />,
  sent: <CheckCircle size={16} className="text-green-500" />,
  cancelled: <XCircle size={16} className="text-gray-400" />,
  completed: <CheckCircle size={16} className="text-blue-500" />,
};

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300',
  sent: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
  cancelled: 'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  completed: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
};

const notifyViaIcons: Record<NotifyVia, React.ReactNode> = {
  email: <Mail size={14} className="text-muted-foreground" />,
  push: <Smartphone size={14} className="text-muted-foreground" />,
  both: (
    <span className="flex items-center gap-0.5">
      <Mail size={14} className="text-muted-foreground" />
      <Smartphone size={14} className="text-muted-foreground" />
    </span>
  ),
};

const notifyViaLabels: Record<NotifyVia, string> = {
  email: 'Email',
  push: 'Push',
  both: 'Both',
};

function getUrgencyBadge(remindAt: string | null, status: string): { label: string; className: string } | null {
  if (status !== 'pending' || !remindAt) return null;

  const reminderDate = new Date(remindAt);

  if (isPast(reminderDate)) {
    return { label: 'Overdue', className: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' };
  }

  const hoursUntil = differenceInHours(reminderDate, new Date());

  if (hoursUntil <= 1) {
    return { label: 'Due very soon', className: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' };
  }
  if (hoursUntil <= 24) {
    return { label: `Due in ${formatDistanceToNow(reminderDate)}`, className: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300' };
  }
  if (hoursUntil <= 72) {
    return { label: `Due in ${formatDistanceToNow(reminderDate)}`, className: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' };
  }

  return null;
}

export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');
  const [deleteTarget, setDeleteTarget] = useState<Reminder | null>(null);
  const [editTarget, setEditTarget] = useState<Reminder | null>(null);
  const [editMessage, setEditMessage] = useState('');
  const [editRemindAt, setEditRemindAt] = useState('');
  const [editNotifyVia, setEditNotifyVia] = useState<NotifyVia>('email');
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    fetchReminders();
  }, [page, filter]);

  const fetchReminders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });
      if (filter) params.set('status', filter);

      const res = await fetch(`/api/reminders?${params}`);
      const data: RemindersResponse = await res.json();
      setReminders(data.reminders);
      setTotalPages(data.totalPages);
    } catch (error) {
      console.error('Failed to fetch reminders:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await fetch(`/api/reminders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      fetchReminders();
    } catch (error) {
      console.error('Failed to update reminder:', error);
    }
  };

  const deleteReminder = async (id: string) => {
    try {
      await fetch(`/api/reminders/${id}`, {
        method: 'DELETE',
      });
      setDeleteTarget(null);
      fetchReminders();
    } catch (error) {
      console.error('Failed to delete reminder:', error);
    }
  };

  const openEditDialog = (reminder: Reminder) => {
    setEditTarget(reminder);
    setEditMessage(reminder.message);
    setEditRemindAt(
      reminder.remindAt
        ? format(new Date(reminder.remindAt), "yyyy-MM-dd'T'HH:mm")
        : ''
    );
    setEditNotifyVia(reminder.notifyVia || 'email');
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    setEditLoading(true);
    try {
      // Convert local datetime string to ISO (UTC) before sending to server
      // This ensures the server receives the correct UTC time regardless of server timezone
      const remindAtISO = editRemindAt ? new Date(editRemindAt).toISOString() : null;

      await fetch(`/api/reminders/${editTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: editMessage,
          remindAt: remindAtISO,
          notifyVia: editNotifyVia,
        }),
      });
      setEditTarget(null);
      fetchReminders();
    } catch (error) {
      console.error('Failed to update reminder:', error);
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-foreground">Reminders</h1>
        <Link href="/reminders/new">
          <Button>
            <Plus size={20} className="mr-2" />
            New Reminder
          </Button>
        </Link>
      </div>

      <div className="flex gap-2 mb-6">
        {['', 'pending', 'sent', 'completed', 'cancelled'].map((status) => (
          <Button
            key={status}
            variant={filter === status ? 'default' : 'secondary'}
            size="sm"
            onClick={() => {
              setFilter(status);
              setPage(1);
            }}
          >
            {status || 'All'}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        </div>
      ) : reminders.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Bell size={48} className="mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No reminders yet. Create your first reminder!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reminders.map((reminder) => (
            <Card key={reminder.id}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {statusIcons[reminder.status]}
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${statusColors[reminder.status]}`}
                      >
                        {reminder.status}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        {notifyViaIcons[reminder.notifyVia || 'email']}
                        <span>{notifyViaLabels[reminder.notifyVia || 'email']}</span>
                      </span>
                      {(() => {
                        const urgency = getUrgencyBadge(reminder.remindAt, reminder.status);
                        return urgency ? (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${urgency.className}`}>
                            {urgency.label}
                          </span>
                        ) : null;
                      })()}
                    </div>
                    <p className="text-foreground mb-2">{reminder.message}</p>
                    <p className="text-sm text-muted-foreground">
                      {reminder.remindAt
                        ? `Remind at: ${format(new Date(reminder.remindAt), 'MMM d, yyyy h:mm a')}`
                        : 'No time set'}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    {reminder.status === 'pending' && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(reminder)}
                        >
                          <Pencil size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updateStatus(reminder.id, 'completed')}
                        >
                          Complete
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updateStatus(reminder.id, 'cancelled')}
                        >
                          Cancel
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTarget(reminder)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          <Button
            variant="secondary"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="flex items-center px-4 text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="secondary"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </Button>
        </div>
      )}

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Reminder</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this reminder? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteTarget && (
            <p className="text-sm text-muted-foreground border-l-2 pl-3">
              {deleteTarget.message}
            </p>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteReminder(deleteTarget.id)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Reminder</DialogTitle>
            <DialogDescription>
              Update your reminder details below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-message">Message</Label>
              <Textarea
                id="edit-message"
                value={editMessage}
                onChange={(e) => setEditMessage(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-remindAt">Remind At</Label>
              <Input
                id="edit-remindAt"
                type="datetime-local"
                value={editRemindAt}
                onChange={(e) => setEditRemindAt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Notify Via</Label>
              <div className="flex gap-2">
                {NOTIFY_VIA_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={editNotifyVia === option.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setEditNotifyVia(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={editLoading || !editMessage.trim()}>
              {editLoading ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
