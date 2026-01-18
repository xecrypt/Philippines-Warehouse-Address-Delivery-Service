'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Role } from '@warehouse/shared';
import { useAuth } from '@/lib/auth';
import { Sidebar, Header } from '@/components/layout';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }

    // Only ADMIN can access these routes
    if (user?.role !== Role.ADMIN) {
      router.replace('/');
    }
  }, [isAuthenticated, isLoading, user, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== Role.ADMIN) {
    return null;
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <Sidebar />
      <div className="pl-64">
        <Header />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
