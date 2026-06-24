import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Finanças', description: 'Gestão financeira multiperfil e multimoeda' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="pt"><body>{children}</body></html>;
}
