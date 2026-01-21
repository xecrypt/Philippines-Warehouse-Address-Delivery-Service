'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Role } from '@warehouse/shared';
import { useAuth } from '@/lib/auth';
import { Sidebar, SidebarProvider, Header } from '@/components/layout';

export default function DashboardLayout({
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

    // Only USER role can access these routes
    if (user?.role !== Role.USER) {
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

  if (!isAuthenticated || user?.role !== Role.USER) {
    return null;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen bg-muted/30">
        <Sidebar />
        <div className="lg:pl-64">
          <Header />
          <main className="p-4 lg:p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
