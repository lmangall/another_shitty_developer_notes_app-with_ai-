'use client';

import { useState, useEffect } from 'react';
import { Plus, Tag, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TagBadge } from '@/components/tag-badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface Tag {
  id: string;
  name: string;
  color: string;
}

const TAG_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#6b7280', // gray
];

interface TagPickerProps {
  noteId: string;
  currentTags: Tag[];
  onTagsChange: () => void;
}

export function TagPicker({ noteId, currentTags, onTagsChange }: TagPickerProps) {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchTags();
    }
  }, [isOpen]);

  async function fetchTags() {
    setIsLoading(true);
    try {
      const res = await fetch('/api/tags');
      const data = await res.json();
      setAllTags(data.tags || []);
    } catch (error) {
      console.error('Failed to fetch tags:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function createTag() {
    if (!newTagName.trim() || isCreating) return;

    setIsCreating(true);
    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTagName.trim(), color: newTagColor }),
      });

      if (res.ok) {
        const data = await res.json();
        setAllTags([...allTags, data.tag]);
        setNewTagName('');
        // Auto-add the new tag to the note
        await addTagToNote(data.tag.id);
      }
    } catch (error) {
      console.error('Failed to create tag:', error);
    } finally {
      setIsCreating(false);
    }
  }

  async function addTagToNote(tagId: string) {
    try {
      await fetch(`/api/notes/${noteId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagId }),
      });
      onTagsChange();
    } catch (error) {
      console.error('Failed to add tag:', error);
    }
  }

  async function removeTagFromNote(tagId: string) {
    try {
      await fetch(`/api/notes/${noteId}/tags`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagId }),
      });
      onTagsChange();
    } catch (error) {
      console.error('Failed to remove tag:', error);
    }
  }

  const currentTagIds = new Set(currentTags.map(t => t.id));
  const availableTags = allTags.filter(t => !currentTagIds.has(t.id));

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1 h-7 px-2">
          <Tag size={14} />
          <Plus size={12} />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Manage Tags</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current tags on this note */}
          {currentTags.length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Tags on this note:</p>
              <div className="flex flex-wrap gap-2">
                {currentTags.map(tag => (
                  <TagBadge
                    key={tag.id}
                    name={tag.name}
                    color={tag.color}
                    onRemove={() => removeTagFromNote(tag.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Available tags to add */}
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : availableTags.length > 0 ? (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Add existing tag:</p>
              <div className="flex flex-wrap gap-2">
                {availableTags.map(tag => (
                  <button
                    key={tag.id}
                    onClick={() => addTagToNote(tag.id)}
                    className="hover:opacity-80 transition-opacity"
                  >
                    <TagBadge name={tag.name} color={tag.color} />
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* Create new tag */}
          <div>
            <p className="text-sm text-muted-foreground mb-2">Create new tag:</p>
            <div className="flex gap-2">
              <Input
                placeholder="Tag name..."
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createTag()}
                className="flex-1"
              />
              <Button
                onClick={createTag}
                disabled={!newTagName.trim() || isCreating}
                size="sm"
              >
                {isCreating ? <Loader2 size={14} className="animate-spin" /> : 'Add'}
              </Button>
            </div>
            <div className="flex gap-1 mt-2">
              {TAG_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => setNewTagColor(color)}
                  className={`w-6 h-6 rounded-full transition-transform ${
                    newTagColor === color ? 'ring-2 ring-offset-2 ring-primary scale-110' : ''
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
