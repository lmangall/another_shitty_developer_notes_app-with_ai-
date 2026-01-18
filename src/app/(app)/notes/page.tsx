'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, FileText, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { format } from 'date-fns';

interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

interface NotesResponse {
  notes: Note[];
  total: number;
  page: number;
  totalPages: number;
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null);

  useEffect(() => {
    fetchNotes();
  }, [page, search]);

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });
      if (search) params.set('search', search);

      const res = await fetch(`/api/notes?${params}`);
      const data: NotesResponse = await res.json();
      setNotes(data.notes);
      setTotalPages(data.totalPages);
    } catch (error) {
      console.error('Failed to fetch notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchNotes();
  };

  const deleteNote = async (id: string) => {
    try {
      await fetch(`/api/notes/${id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      fetchNotes();
    } catch (error) {
      console.error('Failed to delete note:', error);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Search */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="relative">
          <Search
            size={20}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            placeholder="Search notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </form>

      {/* Notes Grid */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        </div>
      ) : notes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText size={48} className="mx-auto mb-4 opacity-50" />
          <p>No notes yet. Create one from the sidebar!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {notes.map((note) => (
            <Card key={note.id} className="h-full hover:border-primary/50 hover:shadow-md transition-all group relative">
              <Link href={`/notes/${note.id}`}>
                <CardContent className="p-5 h-full flex flex-col cursor-pointer">
                  <h3 className="font-semibold text-foreground mb-2 line-clamp-1 group-hover:text-primary transition-colors pr-8">
                    {note.title}
                  </h3>
                  <p className="text-muted-foreground text-sm line-clamp-4 flex-1 mb-3">
                    {note.content}
                  </p>
                  <p className="text-xs text-muted-foreground/60">
                    {format(new Date(note.updatedAt), 'MMM d, yyyy')}
                  </p>
                </CardContent>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  setDeleteTarget(note);
                }}
                className="absolute top-3 right-3 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 size={16} />
              </Button>
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

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Note</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this note? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteTarget && (
            <p className="text-sm font-medium border-l-2 pl-3">
              {deleteTarget.title}
            </p>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteNote(deleteTarget.id)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
