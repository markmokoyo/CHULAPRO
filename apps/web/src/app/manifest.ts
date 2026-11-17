import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CuePulse AI — สตูดิโอฝึกซ้อมการนำเสนอ',
    short_name: 'CuePulse',
    description:
      'แอปฝึกทักษะการพูดและนำเสนอ วิเคราะห์จังหวะการพูด คำติดปาก และการสบตาผู้ฟัง',
    start_url: '/',
    display: 'standalone',
    background_color: '#FDF8FA',
    theme_color: '#EC3D6A',
    icons: [
      {
        src: '/logo-chula.jpg',
        sizes: '192x192',
        type: 'image/jpeg',
      },
    ],
  };
}
