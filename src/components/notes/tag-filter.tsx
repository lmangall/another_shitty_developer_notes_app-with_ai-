'use client';

import { useState, useEffect } from 'react';
import { Tag, ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface TagData {
  id: string;
  name: string;
  color: string;
}

interface TagFilterProps {
  selectedTagIds: string[];
  onTagsChange: (tagIds: string[]) => void;
}

export function TagFilter({ selectedTagIds, onTagsChange }: TagFilterProps) {
  const [tags, setTags] = useState<TagData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchTags();
  }, []);

  async function fetchTags() {
    setIsLoading(true);
    try {
      const res = await fetch('/api/tags');
      const data = await res.json();
      setTags(data.tags || []);
    } catch (error) {
      console.error('Failed to fetch tags:', error);
    } finally {
      setIsLoading(false);
    }
  }

  function toggleTag(tagId: string) {
    if (selectedTagIds.includes(tagId)) {
      onTagsChange(selectedTagIds.filter(id => id !== tagId));
    } else {
      onTagsChange([...selectedTagIds, tagId]);
    }
  }

  function clearTags() {
    onTagsChange([]);
  }

  const selectedCount = selectedTagIds.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Tag size={14} />
          Tags
          {selectedCount > 0 && (
            <span className="bg-primary text-primary-foreground text-xs rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center">
              {selectedCount}
            </span>
          )}
          <ChevronDown size={14} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {isLoading ? (
          <div className="px-2 py-4 text-sm text-muted-foreground text-center">
            Loading tags...
          </div>
        ) : tags.length === 0 ? (
          <div className="px-2 py-4 text-sm text-muted-foreground text-center">
            No tags yet
          </div>
        ) : (
          <>
            {tags.map(tag => (
              <DropdownMenuCheckboxItem
                key={tag.id}
                checked={selectedTagIds.includes(tag.id)}
                onCheckedChange={() => toggleTag(tag.id)}
              >
                <span
                  className="w-2 h-2 rounded-full mr-2"
                  style={{ backgroundColor: tag.color }}
                />
                {tag.name}
              </DropdownMenuCheckboxItem>
            ))}
            {selectedCount > 0 && (
              <>
                <DropdownMenuSeparator />
                <button
                  onClick={clearTags}
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-sm"
                >
                  <X size={14} />
                  Clear selection
                </button>
              </>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
