'use client';

import { Clock, CheckCircle, XCircle, Mail, Smartphone, Trash2, Pencil, MoreVertical, Check, Ban } from 'lucide-react';
import { format, isPast, differenceInHours, formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { NotifyVia } from '@/lib/constants';

interface Reminder {
  id: string;
  message: string;
  remindAt: string | null;
  notifyVia: NotifyVia;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface ReminderCardProps {
  reminder: Reminder;
  selected: boolean;
  onSelect: (id: string) => void;
  onDelete: (reminder: Reminder) => void;
  onEdit: (reminder: Reminder) => void;
  onStatusChange: (id: string, status: string) => void;
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

export function ReminderCard({
  reminder,
  selected,
  onSelect,
  onDelete,
  onEdit,
  onStatusChange,
}: ReminderCardProps) {
  const urgency = getUrgencyBadge(reminder.remindAt, reminder.status);

  return (
    <Card className={selected ? 'ring-2 ring-primary' : ''}>
      <CardContent className="py-4">
        <div className="flex items-start gap-3">
          <Checkbox
            checked={selected}
            onCheckedChange={() => onSelect(reminder.id)}
            className="mt-1"
          />
          <div className="flex-1 min-w-0">
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
              {urgency && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${urgency.className}`}>
                  {urgency.label}
                </span>
              )}
            </div>
            <p className="text-foreground mb-2">{reminder.message}</p>
            <p className="text-sm text-muted-foreground">
              {reminder.remindAt
                ? `Remind at: ${format(new Date(reminder.remindAt), 'MMM d, yyyy h:mm a')}`
                : 'No time set'}
            </p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {reminder.status === 'pending' && (
                <>
                  <DropdownMenuItem onClick={() => onEdit(reminder)}>
                    <Pencil size={14} className="mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onStatusChange(reminder.id, 'completed')}>
                    <Check size={14} className="mr-2" />
                    Mark Complete
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onStatusChange(reminder.id, 'cancelled')}>
                    <Ban size={14} className="mr-2" />
                    Cancel
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem
                onClick={() => onDelete(reminder)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 size={14} className="mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
