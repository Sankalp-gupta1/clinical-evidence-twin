import type { Metadata } from 'next';
import '@fontsource-variable/dm-sans';
import '@fontsource-variable/manrope';
import './globals.css';
export const metadata: Metadata = {
  title: 'Clinical Evidence Twin — See the full story',
  description:
    'A source-linked workspace for understanding synthetic patient records, checking differences, and documenting human review.',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
