import type { Metadata, Viewport } from 'next';
import { Inter, Noto_Sans_Thai } from 'next/font/google';
import './globals.css';
import { Navbar } from '@/components/Navbar';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const notoThai = Noto_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto-thai',
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
    <html lang="th" className={`${inter.variable} ${notoThai.variable}`}>
      <body className="font-sans antialiased bg-[#FAF6F7] text-[#1F161A]">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 pt-5 pb-28 sm:px-6 sm:pb-10 lg:px-8">
          {children}
        </main>
      </body>
    </html>
  );
}
