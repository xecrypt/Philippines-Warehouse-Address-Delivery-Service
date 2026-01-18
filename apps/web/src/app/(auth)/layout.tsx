'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Package } from 'lucide-react';
import { useAuth } from '@/lib/auth';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/50 p-4">
      <div className="mb-8 flex items-center gap-2">
        <Package className="h-10 w-10 text-primary" />
        <span className="text-2xl font-bold">Warehouse</span>
      </div>
      {children}
    </div>
  );
}
