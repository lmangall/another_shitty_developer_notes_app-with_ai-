'use client';

import { useState, useEffect, useTransition } from 'react';
import { Plus, Tag, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TagBadge } from '@/components/tag-badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { getTags, createTag, addTagToNote, removeTagFromNote } from '@/actions/tags';
import type { Tag as TagType } from '@/db/schema';

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
  currentTags: { id: string; name: string; color: string }[];
  onTagsChange: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
}

export function TagPicker({ noteId, currentTags, onTagsChange, open, onOpenChange, showTrigger = true }: TagPickerProps) {
  const [allTags, setAllTags] = useState<TagType[]>([]);
  const [internalOpen, setInternalOpen] = useState(false);

  const isOpen = open ?? internalOpen;
  const setIsOpen = onOpenChange ?? setInternalOpen;
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(false);

  const fetchTags = async () => {
    setIsLoading(true);
    const result = await getTags();
    if (result.success) {
      setAllTags(result.data);
    }
    setIsLoading(false);
  };

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (isOpen) {
      fetchTags();
    }
  }, [isOpen]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function handleCreateTag() {
    if (!newTagName.trim() || isPending) return;

    startTransition(async () => {
      const result = await createTag({ name: newTagName.trim(), color: newTagColor });
      if (result.success) {
        setAllTags([...allTags, result.data]);
        setNewTagName('');
        // Auto-add the new tag to the note
        await handleAddTagToNote(result.data.id);
      }
    });
  }

  async function handleAddTagToNote(tagId: string) {
    startTransition(async () => {
      const result = await addTagToNote({ noteId, tagId });
      if (result.success) {
        onTagsChange();
      }
    });
  }

  async function handleRemoveTagFromNote(tagId: string) {
    startTransition(async () => {
      const result = await removeTagFromNote({ noteId, tagId });
      if (result.success) {
        onTagsChange();
      }
    });
  }

  const currentTagIds = new Set(currentTags.map(t => t.id));
  const availableTags = allTags.filter(t => !currentTagIds.has(t.id));

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {showTrigger && (
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1 h-7 px-2">
            <Tag size={14} />
            <Plus size={12} />
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Manage Tags</DialogTitle>
          <DialogDescription className="sr-only">
            Add or remove tags from this note
          </DialogDescription>
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
                    onRemove={() => handleRemoveTagFromNote(tag.id)}
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
                    onClick={() => handleAddTagToNote(tag.id)}
                    className="hover:opacity-80 transition-opacity"
                    disabled={isPending}
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
                onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
                className="flex-1"
              />
              <Button
                onClick={handleCreateTag}
                disabled={!newTagName.trim() || isPending}
                size="sm"
              >
                {isPending ? <Loader2 size={14} className="animate-spin" /> : 'Add'}
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
