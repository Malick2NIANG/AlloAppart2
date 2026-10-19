import type { Metadata, Viewport } from 'next';
import { Inter, Poppins } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';
import { ToastProvider } from '@/components/ui/ToastProvider';
import CookieConsentBanner from '@/components/ui/CookieConsentBanner';
import ConnectivityWatcher from '@/components/ui/ConnectivityWatcher';
import { LocaleTransitionProvider } from '@/components/ui/LocaleTransition';
import LocaleTransitionOverlay from '@/components/ui/LocaleTransitionOverlay';
import ServiceWorkerRegister from '@/components/ui/ServiceWorkerRegister';
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

// width=device-width/initialScale=1 reprennent le viewport par défaut de
// Next.js (aucun changement) ; viewportFit='cover' est le seul ajout réel —
// nécessaire pour que env(safe-area-inset-*) se résolve sur les appareils à
// encoche (sinon toujours 0), utilisé par --safe-bottom ci-dessous. Sans
// effet sur desktop ni sur un appareil sans encoche.
// themeColor : couleur de la barre de statut/chrome une fois l'app
// installée (lot 0d, PWA) — clair = BRAND.gold, sombre = BRAND.navy
// (identiques à globals.css --aa-bg du thème sombre). N'affecte que les
// navigateurs/OS qui lisent cette méta ; aucun effet sur l'affichage de la
// page elle-même.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#facc15' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
};

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
    apple: '/icons/apple-touch-icon.png',
  },
  // PWA (lot 0d) — mode standalone sur iOS (Safari ne lit pas le manifeste
  // pour ça) : sans effet sur l'affichage normal du site dans un navigateur.
  appleWebApp: {
    capable: true,
    title: 'AlloAppart',
    statusBarStyle: 'default',
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
            <LocaleTransitionProvider>
              <ToastProvider>
                <ConnectivityWatcher />
                {children}
                <CookieConsentBanner />
                <LocaleTransitionOverlay />
                <ServiceWorkerRegister />
              </ToastProvider>
            </LocaleTransitionProvider>
          </NextIntlClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
