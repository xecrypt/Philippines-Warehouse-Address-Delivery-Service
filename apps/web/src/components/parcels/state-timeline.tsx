'use client';

import { Check } from 'lucide-react';
import { ParcelState, PARCEL_STATE_LABELS, PARCEL_STATE_TRANSITIONS } from '@warehouse/shared';
import { cn } from '@/lib/utils/cn';
import type { ParcelStateHistory } from '@warehouse/shared';

interface ParcelStateTimelineProps {
  currentState: ParcelState;
  history: ParcelStateHistory[];
}

// Ordered states for the timeline
const STATE_ORDER: ParcelState[] = [
  ParcelState.EXPECTED,
  ParcelState.ARRIVED,
  ParcelState.STORED,
  ParcelState.DELIVERY_REQUESTED,
  ParcelState.OUT_FOR_DELIVERY,
  ParcelState.DELIVERED,
];

export function ParcelStateTimeline({ currentState, history }: ParcelStateTimelineProps) {
  const currentIndex = STATE_ORDER.indexOf(currentState);

  const getStateTimestamp = (state: ParcelState): string | null => {
    const entry = history.find((h) => h.toState === state);
    return entry ? new Date(entry.createdAt).toLocaleString() : null;
  };

  return (
    <div className="relative">
      {/* Progress Line */}
      <div className="absolute left-4 top-4 h-[calc(100%-2rem)] w-0.5 bg-muted" />
      <div
        className="absolute left-4 top-4 w-0.5 bg-primary transition-all duration-500"
        style={{
          height: `calc(${(currentIndex / (STATE_ORDER.length - 1)) * 100}% - 2rem)`,
        }}
      />

      {/* States */}
      <div className="space-y-6">
        {STATE_ORDER.map((state, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isFuture = index > currentIndex;
          const timestamp = getStateTimestamp(state);

          return (
            <div key={state} className="relative flex items-start gap-4 pl-0">
              {/* Circle */}
              <div
                className={cn(
                  'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                  isCompleted && 'border-primary bg-primary text-primary-foreground',
                  isCurrent && 'border-primary bg-background ring-4 ring-primary/20',
                  isFuture && 'border-muted bg-muted'
                )}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <span
                    className={cn(
                      'h-2 w-2 rounded-full',
                      isCurrent && 'bg-primary',
                      isFuture && 'bg-muted-foreground/30'
                    )}
                  />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 pb-2">
                <p
                  className={cn(
                    'font-medium',
                    isFuture && 'text-muted-foreground'
                  )}
                >
                  {PARCEL_STATE_LABELS[state]}
                </p>
                {timestamp && (
                  <p className="text-xs text-muted-foreground">{timestamp}</p>
                )}
                {isCurrent && (
                  <span className="mt-1 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    Current
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
