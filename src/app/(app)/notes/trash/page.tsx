'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Trash2, RotateCcw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TagBadge } from '@/components/tag-badge';
import { format } from 'date-fns';

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string;
  tags: Tag[];
}

interface TrashResponse {
  notes: Note[];
  total: number;
  page: number;
  totalPages: number;
}

export default function TrashPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);

  useEffect(() => {
    fetchTrash();
  }, [page]);

  const fetchTrash = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });

      const res = await fetch(`/api/notes/trash?${params}`);
      const data: TrashResponse = await res.json();
      setNotes(data.notes);
      setTotalPages(data.totalPages);
    } catch (error) {
      console.error('Failed to fetch trash:', error);
    } finally {
      setLoading(false);
    }
  };

  const restoreNote = async (id: string) => {
    setRestoring(id);
    try {
      const res = await fetch(`/api/notes/${id}/restore`, { method: 'POST' });
      if (res.ok) {
        fetchTrash();
      }
    } catch (error) {
      console.error('Failed to restore note:', error);
    } finally {
      setRestoring(null);
    }
  };

  const permanentlyDelete = async (id: string) => {
    try {
      await fetch(`/api/notes/${id}/permanent`, { method: 'DELETE' });
      setDeleteTarget(null);
      fetchTrash();
    } catch (error) {
      console.error('Failed to permanently delete note:', error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Trash2 size={24} />
            Trash
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Deleted notes can be restored or permanently removed
          </p>
        </div>
        <Link href="/notes">
          <Button variant="outline">Back to Notes</Button>
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        </div>
      ) : notes.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Trash2 size={48} className="mx-auto text-muted-foreground mb-4 opacity-50" />
            <p className="text-muted-foreground">Trash is empty</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {notes.map((note) => (
            <Card key={note.id} className="hover:border-muted-foreground/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground line-clamp-1 mb-1">
                      {note.title}
                    </h3>
                    {note.tags && note.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {note.tags.slice(0, 5).map(tag => (
                          <TagBadge key={tag.id} name={tag.name} color={tag.color} />
                        ))}
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {note.content.replace(/[#*`\n]/g, ' ').slice(0, 200)}
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-2">
                      Deleted {format(new Date(note.deletedAt), 'MMM d, yyyy \'at\' h:mm a')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => restoreNote(note.id)}
                      disabled={restoring === note.id}
                      className="gap-1"
                    >
                      <RotateCcw size={14} />
                      {restoring === note.id ? 'Restoring...' : 'Restore'}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteTarget(note)}
                      className="gap-1"
                    >
                      <Trash2 size={14} />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
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

      {/* Permanent Delete Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle size={20} />
              Permanently Delete Note
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. The note will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          {deleteTarget && (
            <p className="text-sm font-medium border-l-2 border-destructive pl-3">
              {deleteTarget.title}
            </p>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && permanentlyDelete(deleteTarget.id)}
            >
              Delete Forever
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
