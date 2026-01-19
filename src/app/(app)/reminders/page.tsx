'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Bell, Trash2 } from 'lucide-react';
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
import { format } from 'date-fns';
import { RemindersTable } from '@/components/reminders/reminders-table';
import { RemindersFilterBar } from '@/components/reminders/reminders-filter-bar';
import { ReminderCard } from '@/components/reminders/reminder-card';
import { ViewToggle } from '@/components/notes/view-toggle';
import {
  NOTIFY_VIA_OPTIONS,
  type NotifyVia,
  type ReminderSortOption,
  type SortOrder,
  type ReminderStatus,
  type ViewOption,
  type Recurrence,
} from '@/lib/constants';

const VIEW_STORAGE_KEY = 'reminders-view-preference';

interface Reminder {
  id: string;
  message: string;
  remindAt: string | null;
  notifyVia: NotifyVia;
  status: string;
  recurrence: Recurrence | null;
  recurrenceEndDate: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RemindersResponse {
  reminders: Reminder[];
  total: number;
  page: number;
  totalPages: number;
}

export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // View
  const [view, setView] = useState<ViewOption>('grid');

  // Filters
  const [statusFilter, setStatusFilter] = useState<ReminderStatus | ''>('');
  const [notifyViaFilter, setNotifyViaFilter] = useState<NotifyVia | ''>('');
  const [sortBy, setSortBy] = useState<ReminderSortOption>('remindAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Dialogs
  const [deleteTarget, setDeleteTarget] = useState<Reminder | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Reminder | null>(null);
  const [editMessage, setEditMessage] = useState('');
  const [editRemindAt, setEditRemindAt] = useState('');
  const [editNotifyVia, setEditNotifyVia] = useState<NotifyVia>('email');
  const [editLoading, setEditLoading] = useState(false);

  // Load view preference from localStorage
  useEffect(() => {
    const savedView = localStorage.getItem(VIEW_STORAGE_KEY);
    if (savedView === 'grid' || savedView === 'table') {
      setView(savedView);
    }
  }, []);

  function handleViewChange(newView: ViewOption) {
    setView(newView);
    localStorage.setItem(VIEW_STORAGE_KEY, newView);
  }

  useEffect(() => {
    fetchReminders();
  }, [page, statusFilter, notifyViaFilter, sortBy, sortOrder]);

  const fetchReminders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        sortBy,
        sortOrder,
      });
      if (statusFilter) params.set('status', statusFilter);
      if (notifyViaFilter) params.set('notifyVia', notifyViaFilter);

      const res = await fetch(`/api/reminders?${params}`);
      const data: RemindersResponse = await res.json();
      setReminders(data.reminders);
      setTotalPages(data.totalPages);
      // Clear selection when data changes
      setSelectedIds(new Set());
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

  const bulkDelete = async () => {
    try {
      await Promise.all(
        Array.from(selectedIds).map(id =>
          fetch(`/api/reminders/${id}`, { method: 'DELETE' })
        )
      );
      setBulkDeleteOpen(false);
      setSelectedIds(new Set());
      fetchReminders();
    } catch (error) {
      console.error('Failed to delete reminders:', error);
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

  const handleSortChange = (column: ReminderSortOption) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-foreground">Reminders</h1>
        <Link href="/reminders/new">
          <Button>
            <Plus size={20} className="mr-2" />
            New Reminder
          </Button>
        </Link>
      </div>

      {/* Filters, View Toggle, and Bulk Actions */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <RemindersFilterBar
          statusFilter={statusFilter}
          onStatusFilterChange={(s) => { setStatusFilter(s); setPage(1); }}
          notifyViaFilter={notifyViaFilter}
          onNotifyViaFilterChange={(n) => { setNotifyViaFilter(n); setPage(1); }}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortByChange={setSortBy}
          onSortOrderChange={setSortOrder}
        />

        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setBulkDeleteOpen(true)}
              className="gap-2"
            >
              <Trash2 size={14} />
              Delete {selectedIds.size} selected
            </Button>
          )}
          <ViewToggle view={view} onViewChange={handleViewChange} />
        </div>
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
      ) : view === 'table' ? (
        <RemindersTable
          reminders={reminders}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={handleSortChange}
          onDelete={setDeleteTarget}
          onEdit={openEditDialog}
          onStatusChange={updateStatus}
        />
      ) : (
        <div className="space-y-4">
          {reminders.map((reminder) => (
            <ReminderCard
              key={reminder.id}
              reminder={reminder}
              selected={selectedIds.has(reminder.id)}
              onSelect={toggleSelection}
              onDelete={setDeleteTarget}
              onEdit={openEditDialog}
              onStatusChange={updateStatus}
            />
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

      {/* Single Delete Dialog */}
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

      {/* Bulk Delete Dialog */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selectedIds.size} Reminders</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedIds.size} reminders? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setBulkDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={bulkDelete}>
              Delete {selectedIds.size} Reminders
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
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
