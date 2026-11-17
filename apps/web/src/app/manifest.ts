import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CuePulse AI — สตูดิโอฝึกซ้อมการนำเสนอ',
    short_name: 'CuePulse',
    description:
      'แอปฝึกทักษะการพูดและนำเสนอ วิเคราะห์จังหวะการพูด คำติดปาก การสบตา และเชื่อมต่อสมาร์ทวอทช์',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#FDF8FA',
    theme_color: '#EC3D6A',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
