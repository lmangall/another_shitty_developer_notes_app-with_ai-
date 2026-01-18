'use client';

import { ArrowUpDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { TagFilter } from './tag-filter';
import { DateRangeFilter } from './date-range-filter';
import { NOTE_SORT_OPTIONS, SORT_ORDER_OPTIONS, type NoteSortOption, type SortOrder } from '@/lib/constants';

interface NotesFilterBarProps {
  selectedTagIds: string[];
  onTagsChange: (tagIds: string[]) => void;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (date: string) => void;
  onDateToChange: (date: string) => void;
  sortBy: NoteSortOption;
  sortOrder: SortOrder;
  onSortByChange: (value: NoteSortOption) => void;
  onSortOrderChange: (value: SortOrder) => void;
}

export function NotesFilterBar({
  selectedTagIds,
  onTagsChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  sortBy,
  sortOrder,
  onSortByChange,
  onSortOrderChange,
}: NotesFilterBarProps) {
  const hasAnyFilter = selectedTagIds.length > 0 || dateFrom || dateTo;

  function clearAllFilters() {
    onTagsChange([]);
    onDateFromChange('');
    onDateToChange('');
  }

  const currentSortLabel = NOTE_SORT_OPTIONS.find(o => o.value === sortBy)?.label || 'Sort';
  const currentOrderLabel = sortOrder === 'desc' ? 'Newest first' : 'Oldest first';

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <TagFilter
        selectedTagIds={selectedTagIds}
        onTagsChange={onTagsChange}
      />

      <DateRangeFilter
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={onDateFromChange}
        onDateToChange={onDateToChange}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <ArrowUpDown size={14} />
            {currentSortLabel}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Sort by
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup value={sortBy} onValueChange={(v) => onSortByChange(v as NoteSortOption)}>
            {NOTE_SORT_OPTIONS.map(option => (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>

          <DropdownMenuSeparator />

          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Order
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup value={sortOrder} onValueChange={(v) => onSortOrderChange(v as SortOrder)}>
            {SORT_ORDER_OPTIONS.map(option => (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                {option.value === 'desc' ? 'Newest first' : 'Oldest first'}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {hasAnyFilter && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAllFilters}
          className="text-muted-foreground hover:text-foreground gap-1"
        >
          <X size={14} />
          Clear filters
        </Button>
      )}
    </div>
  );
}
