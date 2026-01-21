'use client';

import { Trash2, ArrowUp, ArrowDown, ArrowUpDown, Clock, CheckCircle, XCircle, Mail, Smartphone, Pencil, MoreVertical, Check, Ban, Repeat } from 'lucide-react';
import { format, isPast, differenceInHours, formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ReminderSortOption, SortOrder, Recurrence } from '@/lib/constants';

interface Reminder {
  id: string;
  message: string;
  remindAt: Date | string | null;
  notifyVia: string;
  status: string;
  recurrence: Recurrence | string | null;
  recurrenceEndDate: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  userId?: string;
}

const recurrenceLabels: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

interface RemindersTableProps {
  reminders: Reminder[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  sortBy: ReminderSortOption;
  sortOrder: SortOrder;
  onSortChange: (column: ReminderSortOption) => void;
  onDelete: (reminder: Reminder) => void;
  onEdit: (reminder: Reminder) => void;
  onStatusChange: (id: string, status: string) => void;
}

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock size={14} className="text-yellow-500" />,
  sent: <CheckCircle size={14} className="text-green-500" />,
  cancelled: <XCircle size={14} className="text-gray-400" />,
  completed: <CheckCircle size={14} className="text-blue-500" />,
};

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300',
  sent: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
  cancelled: 'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  completed: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
};

const notifyViaIcons: Record<string, React.ReactNode> = {
  email: <Mail size={14} className="text-muted-foreground" />,
  push: <Smartphone size={14} className="text-muted-foreground" />,
  both: (
    <span className="flex items-center gap-0.5">
      <Mail size={14} className="text-muted-foreground" />
      <Smartphone size={14} className="text-muted-foreground" />
    </span>
  ),
};

function getUrgencyBadge(remindAt: Date | string | null, status: string): { label: string; className: string } | null {
  if (status !== 'pending' || !remindAt) return null;

  const reminderDate = remindAt instanceof Date ? remindAt : new Date(remindAt);

  if (isPast(reminderDate)) {
    return { label: 'Overdue', className: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' };
  }

  const hoursUntil = differenceInHours(reminderDate, new Date());

  if (hoursUntil <= 1) {
    return { label: 'Due soon', className: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' };
  }
  if (hoursUntil <= 24) {
    return { label: formatDistanceToNow(reminderDate), className: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300' };
  }
  if (hoursUntil <= 72) {
    return { label: formatDistanceToNow(reminderDate), className: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' };
  }

  return null;
}

function ReminderSortHeader({
  column,
  label,
  className,
  sortBy,
  sortOrder,
  onSortChange,
}: {
  column: ReminderSortOption;
  label: string;
  className?: string;
  sortBy: ReminderSortOption;
  sortOrder: SortOrder;
  onSortChange: (column: ReminderSortOption) => void;
}) {
  const isActive = sortBy === column;

  return (
    <button
      onClick={() => onSortChange(column)}
      className={`flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors ${className || ''}`}
    >
      {label}
      {isActive ? (
        sortOrder === 'asc' ? (
          <ArrowUp size={12} />
        ) : (
          <ArrowDown size={12} />
        )
      ) : (
        <ArrowUpDown size={12} className="opacity-40" />
      )}
    </button>
  );
}

export function RemindersTable({
  reminders,
  selectedIds,
  onSelectionChange,
  sortBy,
  sortOrder,
  onSortChange,
  onDelete,
  onEdit,
  onStatusChange,
}: RemindersTableProps) {
  const allSelected = reminders.length > 0 && reminders.every(r => selectedIds.has(r.id));
  const someSelected = reminders.some(r => selectedIds.has(r.id)) && !allSelected;

  function toggleAll() {
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(reminders.map(r => r.id)));
    }
  }

  function toggleOne(id: string) {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    onSelectionChange(newSet);
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="text-left px-4 py-3 w-10">
                <Checkbox
                  checked={allSelected}
                  ref={(el) => {
                    if (el) {
                      (el as HTMLButtonElement & { indeterminate: boolean }).indeterminate = someSelected;
                    }
                  }}
                  onCheckedChange={toggleAll}
                />
              </th>
              <th className="text-left px-4 py-3">
                <ReminderSortHeader column="message" label="Message" sortBy={sortBy} sortOrder={sortOrder} onSortChange={onSortChange} />
              </th>
              <th className="text-left px-4 py-3 w-24">
                <ReminderSortHeader column="status" label="Status" sortBy={sortBy} sortOrder={sortOrder} onSortChange={onSortChange} />
              </th>
              <th className="text-left px-4 py-3 hidden sm:table-cell w-20">
                <span className="text-xs font-medium text-muted-foreground">
                  Via
                </span>
              </th>
              <th className="text-right px-4 py-3 w-36">
                <ReminderSortHeader column="remindAt" label="Remind At" className="justify-end" sortBy={sortBy} sortOrder={sortOrder} onSortChange={onSortChange} />
              </th>
              <th className="text-right px-4 py-3 hidden lg:table-cell w-28">
                <ReminderSortHeader column="createdAt" label="Created" className="justify-end" sortBy={sortBy} sortOrder={sortOrder} onSortChange={onSortChange} />
              </th>
              <th className="text-right px-4 py-3 w-28">
                <span className="text-xs font-medium text-muted-foreground">
                  Actions
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {reminders.map((reminder) => {
              const urgency = getUrgencyBadge(reminder.remindAt, reminder.status);
              return (
                <tr
                  key={reminder.id}
                  className="border-b last:border-b-0 hover:bg-muted/30 transition-colors group"
                >
                  {/* Checkbox */}
                  <td className="px-4 py-3">
                    <Checkbox
                      checked={selectedIds.has(reminder.id)}
                      onCheckedChange={() => toggleOne(reminder.id)}
                    />
                  </td>

                  {/* Message */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-foreground line-clamp-1">
                        {reminder.message}
                      </span>
                      {urgency && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap ${urgency.className}`}>
                          {urgency.label}
                        </span>
                      )}
                      {reminder.recurrence && (
                        <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                          <Repeat size={10} />
                          {recurrenceLabels[reminder.recurrence]}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {statusIcons[reminder.status]}
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${statusColors[reminder.status]}`}>
                        {reminder.status}
                      </span>
                    </div>
                  </td>

                  {/* Notify Via */}
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <div className="flex items-center gap-1">
                      {notifyViaIcons[reminder.notifyVia || 'email']}
                    </div>
                  </td>

                  {/* Remind At */}
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm text-muted-foreground">
                      {reminder.remindAt
                        ? format(new Date(reminder.remindAt), 'MMM d, h:mm a')
                        : '—'}
                    </span>
                  </td>

                  {/* Created */}
                  <td className="px-4 py-3 text-right hidden lg:table-cell">
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(reminder.createdAt), 'MMM d, yyyy')}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                          <MoreVertical size={14} />
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
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {reminders.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No reminders match your filters
        </div>
      )}
    </div>
  );
}
