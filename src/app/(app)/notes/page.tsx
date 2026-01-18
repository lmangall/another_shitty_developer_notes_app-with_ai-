'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Search, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
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

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-foreground">Notes</h1>
        <Link href="/notes/new">
          <Button>
            <Plus size={20} className="mr-2" />
            New Note
          </Button>
        </Link>
      </div>

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

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        </div>
      ) : notes.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <FileText size={48} className="mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No notes yet. Create your first note!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {notes.map((note) => (
            <Link key={note.id} href={`/notes/${note.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardContent className="py-4">
                  <h3 className="font-semibold text-foreground mb-1">
                    {note.title}
                  </h3>
                  <p className="text-muted-foreground text-sm line-clamp-2 mb-2">
                    {note.content.slice(0, 150)}...
                  </p>
                  <p className="text-xs text-muted-foreground/70">
                    Updated {format(new Date(note.updatedAt), 'MMM d, yyyy')}
                  </p>
                </CardContent>
              </Card>
            </Link>
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
    </div>
  );
}
