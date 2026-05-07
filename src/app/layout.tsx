import React from 'react';
import type { Metadata, Viewport } from 'next';
import '../styles/index.css';
import { AuthProvider } from '@/contexts/AuthContext';
import ChunkErrorHandler from './ChunkErrorHandler';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'Central Kitchen',
  description: 'Premium catering for weddings, corporate events, and everyday occasions. Weekly meal prep delivered to your door.',
  icons: {
    icon: [
      { url: '/assets/images/Favicon-1778145940787.jpg?v=5', type: 'image/jpeg' },
    ],
    shortcut: '/assets/images/Favicon-1778145940787.jpg?v=5',
    apple: '/assets/images/Favicon-1778145940787.jpg?v=5',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/assets/images/Favicon-1778145940787.jpg?v=5" type="image/jpeg" />
        <link rel="shortcut icon" href="/assets/images/Favicon-1778145940787.jpg?v=5" type="image/jpeg" />
        <link rel="apple-touch-icon" href="/assets/images/Favicon-1778145940787.jpg?v=5" />

        <script type="module" async src="https://static.rocket.new/rocket-web.js?_cfg=https%3A%2F%2Fcateringhu2257back.builtwithrocket.new&_be=https%3A%2F%2Fappanalytics.rocket.new&_v=0.1.18" />
        <script type="module" defer src="https://static.rocket.new/rocket-shot.js?v=0.0.2" /></head>
      <body>
        <ChunkErrorHandler />
        <AuthProvider>
          {children}
        </AuthProvider>
</body>
    </html>
  );
}
