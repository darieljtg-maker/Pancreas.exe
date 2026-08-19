import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import BottomNav from '@/components/BottomNav';
import RegistrarSW from '@/components/RegistrarSW';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata = {
  title: 'PancreasOS',
  description: 'Seguimiento de diabetes tipo 1 de Gaelito',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PancreasOS',
  },
  // No queremos que esto aparezca en Google.
  robots: { index: false, follow: false },
};

export const viewport = {
  themeColor: '#0A0E13',
  width: 'device-width',
  initialScale: 1,
  // Se permite el zoom a propósito: mi mamá lo va a necesitar.
  maximumScale: 5,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <main className="mx-auto w-full max-w-lg px-4 pt-6">{children}</main>
        <BottomNav />
        <RegistrarSW />
      </body>
    </html>
  );
}
