import type { Metadata, Viewport } from 'next';
import { Anuphan, IBM_Plex_Sans_Thai, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { Navbar } from '@/components/Navbar';
import { AppSplashScreen } from '@/components/studio/AppSplashScreen';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-jakarta',
});
const anuphan = Anuphan({
  subsets: ['thai', 'latin'],
  weight: ['500', '600', '700'],
  variable: '--font-anuphan',
});
const ibmPlexThai = IBM_Plex_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ibm-thai',
});

export const viewport: Viewport = {
  themeColor: '#EC3D6A',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'CuePulse — สตูดิโอฝึกซ้อมการนำเสนอ',
  description:
    'เครื่องมือฝึกทักษะการพูดและนำเสนอสำหรับนิสิตและทีมงาน วิเคราะห์จังหวะการพูด คำติดปาก และการสบตาผู้ฟัง',
  icons: {
    icon: '/icon-192.png',
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    title: 'CuePulse',
    statusBarStyle: 'default',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      className={`${plusJakarta.variable} ${anuphan.variable} ${ibmPlexThai.variable}`}
    >
      <body className="font-sans antialiased bg-[#FAF6F7] text-[#1F161A]">
        <AppSplashScreen />
        <Navbar />
        <main className="mx-auto max-w-7xl px-3.5 pt-4 pb-28 sm:px-6 sm:pt-6 sm:pb-12 lg:px-8">
          {children}
        </main>
      </body>
    </html>
  );
}
