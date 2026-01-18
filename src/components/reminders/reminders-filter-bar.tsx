'use client';

import { ArrowUpDown, X, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import {
  REMINDER_SORT_OPTIONS,
  SORT_ORDER_OPTIONS,
  REMINDER_STATUS_OPTIONS,
  NOTIFY_VIA_OPTIONS,
  type ReminderSortOption,
  type SortOrder,
  type ReminderStatus,
  type NotifyVia,
} from '@/lib/constants';

interface RemindersFilterBarProps {
  statusFilter: ReminderStatus | '';
  onStatusFilterChange: (status: ReminderStatus | '') => void;
  notifyViaFilter: NotifyVia | '';
  onNotifyViaFilterChange: (notifyVia: NotifyVia | '') => void;
  sortBy: ReminderSortOption;
  sortOrder: SortOrder;
  onSortByChange: (value: ReminderSortOption) => void;
  onSortOrderChange: (value: SortOrder) => void;
}

export function RemindersFilterBar({
  statusFilter,
  onStatusFilterChange,
  notifyViaFilter,
  onNotifyViaFilterChange,
  sortBy,
  sortOrder,
  onSortByChange,
  onSortOrderChange,
}: RemindersFilterBarProps) {
  const hasAnyFilter = statusFilter || notifyViaFilter;

  function clearAllFilters() {
    onStatusFilterChange('');
    onNotifyViaFilterChange('');
  }

  const currentSortLabel = REMINDER_SORT_OPTIONS.find(o => o.value === sortBy)?.label || 'Sort';
  const statusLabel = statusFilter
    ? REMINDER_STATUS_OPTIONS.find(o => o.value === statusFilter)?.label
    : 'All statuses';
  const notifyViaLabel = notifyViaFilter
    ? NOTIFY_VIA_OPTIONS.find(o => o.value === notifyViaFilter)?.label
    : 'All channels';

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Status Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={`gap-2 ${statusFilter ? 'border-primary' : ''}`}
          >
            <Filter size={14} />
            {statusLabel}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-40">
          <DropdownMenuRadioGroup
            value={statusFilter}
            onValueChange={(v) => onStatusFilterChange(v as ReminderStatus | '')}
          >
            <DropdownMenuRadioItem value="">All statuses</DropdownMenuRadioItem>
            {REMINDER_STATUS_OPTIONS.map(option => (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Notify Via Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={`gap-2 ${notifyViaFilter ? 'border-primary' : ''}`}
          >
            {notifyViaLabel}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-40">
          <DropdownMenuRadioGroup
            value={notifyViaFilter}
            onValueChange={(v) => onNotifyViaFilterChange(v as NotifyVia | '')}
          >
            <DropdownMenuRadioItem value="">All channels</DropdownMenuRadioItem>
            {NOTIFY_VIA_OPTIONS.map(option => (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Sort */}
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
          <DropdownMenuRadioGroup value={sortBy} onValueChange={(v) => onSortByChange(v as ReminderSortOption)}>
            {REMINDER_SORT_OPTIONS.map(option => (
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
