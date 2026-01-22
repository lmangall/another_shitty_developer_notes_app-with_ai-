'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Save, X, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { TiptapEditor } from '@/components/notes/tiptap-editor';
import { format, isValid } from 'date-fns';
import { getNote, updateNote, deleteNote } from '@/actions/notes';
import type { Note } from '@/db/schema';

function formatDate(dateValue: string | Date | null | undefined): string {
  if (!dateValue) return 'Unknown';
  const date = new Date(dateValue);
  return isValid(date) ? format(date, 'MMM d, yyyy h:mm a') : 'Unknown';
}

export default function NoteModal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(true);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [open, setOpen] = useState(true);

  // Don't intercept the trash route - let it render the actual trash page
  const isTrashRoute = id === 'trash';

  useEffect(() => {
    if (!isTrashRoute) {
      fetchNoteData();
    }
  }, [id, isTrashRoute]);

  const fetchNoteData = async () => {
    try {
      const result = await getNote(id);
      if (!result.success) {
        router.back();
        return;
      }
      setNote(result.data);
      setTitle(result.data.title);
      setContent(result.data.content);
    } catch (error) {
      console.error('Failed to fetch note:', error);
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await updateNote({ id, title, content });

      if (!result.success) {
        console.error('Failed to save note:', result.error);
        setSaving(false);
        return;
      }
      // Close modal and refresh the notes list to show changes
      router.back();
      router.refresh();
    } catch (error) {
      console.error('Failed to save note:', error);
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this note?')) return;

    setDeleting(true);
    try {
      const result = await deleteNote(id);
      if (!result.success) {
        console.error('Failed to delete note:', result.error);
        setDeleting(false);
        return;
      }
      router.push('/notes');
      router.refresh();
    } catch (error) {
      console.error('Failed to delete note:', error);
      setDeleting(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    router.back();
  };

  const handleCancel = () => {
    setEditing(false);
    if (note) {
      setTitle(note.title);
      setContent(note.content);
    }
  };

  // Don't render the modal for trash route
  if (isTrashRoute) {
    return null;
  }

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        {loading ? (
          <>
            <SheetHeader>
              <SheetTitle className="sr-only">Loading note...</SheetTitle>
              <SheetDescription className="sr-only">Loading note details</SheetDescription>
            </SheetHeader>
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          </>
        ) : note ? (
          <>
            <SheetHeader className="pr-8">
              <SheetDescription className="sr-only">View and edit note</SheetDescription>
              {editing ? (
                <>
                  <SheetTitle className="sr-only">Editing: {note.title}</SheetTitle>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="text-xl font-bold"
                    autoFocus
                  />
                </>
              ) : (
                <SheetTitle className="text-xl">{note.title}</SheetTitle>
              )}
            </SheetHeader>

            <div className="mt-6 flex-1">
              <TiptapEditor
                value={content}
                onChange={setContent}
                onSave={handleSave}
                editable={editing}
                showToolbar={editing}
                minRows={12}
                onClickToEdit={() => setEditing(true)}
              />
            </div>

            <SheetFooter className="mt-6 flex-col gap-4 sm:flex-col">
              <div className="text-sm text-muted-foreground">
                Created {formatDate(note.createdAt)}
                {note.updatedAt !== note.createdAt && (
                  <span className="ml-4">
                    Updated {formatDate(note.updatedAt)}
                  </span>
                )}
              </div>

              <div className="flex gap-2 justify-end w-full">
                {editing ? (
                  <>
                    <Button variant="ghost" size="sm" onClick={handleCancel}>
                      <X size={18} className="mr-1" />
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={saving}>
                      <Save size={18} className="mr-1" />
                      {saving ? 'Saving...' : 'Save'}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                      <Edit2 size={18} className="mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDelete}
                      disabled={deleting}
                    >
                      <Trash2 size={18} className="mr-1" />
                      {deleting ? 'Deleting...' : 'Delete'}
                    </Button>
                  </>
                )}
              </div>
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
