'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { createNote } from '@/actions/notes';

export default function NewNotePage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setError('Title and content are required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await createNote({ title, content });

      if (!result.success) {
        setError(result.error);
        return;
      }

      router.push(`/notes/${result.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create note');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const { selectionStart } = textarea;
      const text = content;

      const lineStart = text.lastIndexOf('\n', selectionStart - 1) + 1;
      const lineEnd = text.indexOf('\n', selectionStart);
      const currentLine = text.substring(lineStart, lineEnd === -1 ? text.length : lineEnd);

      const bulletMatch = currentLine.match(/^(\s*)([-*])\s/);
      const checkboxMatch = currentLine.match(/^(\s*)([-*])\s\[([ xX])\]\s/);
      const numberedMatch = currentLine.match(/^(\s*)(\d+)\.\s/);

      let listPrefix = '';
      let isEmptyListItem = false;

      if (checkboxMatch) {
        const [fullMatch, indent, marker] = checkboxMatch;
        const lineContent = currentLine.substring(fullMatch.length);
        isEmptyListItem = lineContent.trim() === '';
        listPrefix = `${indent}${marker} [ ] `;
      } else if (bulletMatch) {
        const [fullMatch, indent, marker] = bulletMatch;
        const lineContent = currentLine.substring(fullMatch.length);
        isEmptyListItem = lineContent.trim() === '';
        listPrefix = `${indent}${marker} `;
      } else if (numberedMatch) {
        const [fullMatch, indent, num] = numberedMatch;
        const lineContent = currentLine.substring(fullMatch.length);
        isEmptyListItem = lineContent.trim() === '';
        listPrefix = `${indent}${parseInt(num) + 1}. `;
      }

      if (listPrefix) {
        e.preventDefault();

        if (isEmptyListItem) {
          const beforeLine = text.substring(0, lineStart);
          const afterLine = text.substring(lineEnd === -1 ? text.length : lineEnd);
          const newText = beforeLine.trimEnd() + afterLine;
          setContent(newText);
          setTimeout(() => {
            textarea.focus();
            const newPos = beforeLine.trimEnd().length;
            textarea.setSelectionRange(newPos, newPos);
          }, 0);
        } else {
          const before = text.substring(0, selectionStart);
          const after = text.substring(selectionStart);
          const newText = before + '\n' + listPrefix + after;
          setContent(newText);
          setTimeout(() => {
            textarea.focus();
            const newPos = selectionStart + 1 + listPrefix.length;
            textarea.setSelectionRange(newPos, newPos);
          }, 0);
        }
      }
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/notes"
        className="inline-flex items-center text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft size={20} className="mr-2" />
        Back to Notes
      </Link>

      <Card>
        <CardHeader>
          <h1 className="text-xl font-bold text-foreground">Create New Note</h1>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="Note title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Content</Label>
              <Textarea
                ref={textareaRef}
                id="content"
                placeholder="Write your note here... (Markdown supported)"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={10}
                required
              />
            </div>

            <div className="flex justify-end gap-3">
              <Link href="/notes">
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={loading}>
                {loading ? 'Creating...' : 'Create Note'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
