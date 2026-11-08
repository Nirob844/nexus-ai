import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';

export const metadata: Metadata = {
  title: 'NEXUS AI — Multi-Tenant AI-Powered Business Operations & Support SaaS',
  description: 'Enterprise operations, customer support ticketing engine, RAG knowledge base, and automated AI assistance.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 antialiased text-slate-900">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
