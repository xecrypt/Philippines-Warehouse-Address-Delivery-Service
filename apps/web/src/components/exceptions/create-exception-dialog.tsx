'use client';

import { useState } from 'react';
import { ExceptionType, EXCEPTION_TYPE_LABELS } from '@warehouse/shared';
import * as exceptionsApi from '@/lib/api/exceptions';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';
import type { ParcelWithOwner } from '@warehouse/shared';

interface CreateExceptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parcel: ParcelWithOwner | null;
  onSuccess: () => void;
}

export function CreateExceptionDialog({
  open,
  onOpenChange,
  parcel,
  onSuccess,
}: CreateExceptionDialogProps) {
  const [type, setType] = useState<ExceptionType>(ExceptionType.OTHER);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parcel) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await exceptionsApi.createException({
        parcelId: parcel.id,
        type,
        description,
      });

      if (response.success) {
        setType(ExceptionType.OTHER);
        setDescription('');
        onSuccess();
      } else {
        setError(response.message || 'Failed to create exception');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create exception');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setType(ExceptionType.OTHER);
      setDescription('');
      setError(null);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Exception</DialogTitle>
          <DialogDescription>
            Report an issue with this parcel
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {parcel && (
            <div className="rounded-lg bg-muted p-3">
              <p className="text-sm font-medium">Parcel</p>
              <p className="font-mono">{parcel.trackingNumber}</p>
              {parcel.owner && (
                <p className="text-sm text-muted-foreground">
                  Owner: {parcel.owner.firstName} {parcel.owner.lastName}
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="type">Exception Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as ExceptionType)}>
              <SelectTrigger>
                <SelectValue placeholder="Select exception type" />
              </SelectTrigger>
              <SelectContent>
                {Object.values(ExceptionType).map((exType) => (
                  <SelectItem key={exType} value={exType}>
                    {EXCEPTION_TYPE_LABELS[exType]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              placeholder="Describe the issue..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !description}>
              {isSubmitting ? 'Creating...' : 'Create Exception'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
