import { Toaster, TooltipProvider } from '@phloz/ui';
import { loadGeistFonts } from '@phloz/ui/fonts';

import { buildAppMetadata } from '@/lib/metadata';

import './globals.css';

export const metadata = buildAppMetadata();

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const fonts = await loadGeistFonts();

  return (
    <html lang="en" className={fonts.className} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <TooltipProvider delayDuration={100}>
          {children}
          <Toaster />
        </TooltipProvider>
      </body>
    </html>
  );
}
