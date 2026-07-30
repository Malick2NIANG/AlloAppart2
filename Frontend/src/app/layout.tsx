import type { Metadata } from 'next';
import { Inter, Poppins } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';
import { ToastProvider } from '@/components/ui/ToastProvider';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

const poppins = Poppins({
  variable: '--font-poppins',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  display: 'swap',
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://alloappart.sn';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta');
  const locale = await getLocale();
  return {
  metadataBase: new URL(APP_URL),
  title: {
    default: 'AlloAppart',
    template: 'AlloAppart',
  },
  description: t('description'),
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
  },
  openGraph: {
    siteName: 'AlloAppart',
    locale: locale === 'en' ? 'en_US' : 'fr_SN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
  },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale   = await getLocale();
  const messages = await getMessages();

  /* Thème lu côté serveur → pas de script inline, pas de flash */
  const store = await cookies();
  const isDark = store.get('allo-theme')?.value === 'dark';

  return (
    <ClerkProvider afterSignOutUrl="/">
      <html
        lang={locale}
        className={`${inter.variable} ${poppins.variable}${isDark ? ' dark' : ''}`}
        suppressHydrationWarning
      >
        <head>
          <link
            rel="stylesheet"
            href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"
            crossOrigin="anonymous"
            referrerPolicy="no-referrer"
          />
        </head>
        <body className="min-h-screen flex flex-col bg-bg text-text">
          <NextIntlClientProvider locale={locale} messages={messages}>
            <ToastProvider>
              {children}
            </ToastProvider>
          </NextIntlClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
