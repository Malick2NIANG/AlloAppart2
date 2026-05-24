import Link from 'next/link';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';

const SOCIALS = [
  { icon: 'fa-brands fa-whatsapp',  href: '#', label: 'WhatsApp', color: 'hover:text-green-500 hover:border-green-500' },
  { icon: 'fa-brands fa-facebook',  href: '#', label: 'Facebook', color: 'hover:text-blue-600  hover:border-blue-600'  },
  { icon: 'fa-brands fa-instagram', href: '#', label: 'Instagram',color: 'hover:text-pink-500  hover:border-pink-500'  },
  { icon: 'fa-brands fa-x-twitter', href: '#', label: 'X',        color: 'hover:text-text      hover:border-text'      },
  { icon: 'fa-brands fa-linkedin',  href: '#', label: 'LinkedIn', color: 'hover:text-blue-500  hover:border-blue-500'  },
  { icon: 'fa-brands fa-tiktok',    href: '#', label: 'TikTok',   color: 'hover:text-text      hover:border-text'      },
];

export default async function Footer() {
  const t = await getTranslations('footer');

  const COL2 = [
    { label: t('navListings'),  href: '/listings'            },
    { label: t('navFavorites'), href: '/locataire/favorites' },
    { label: t('navMessages'),  href: '/locataire/messages'  },
  ];

  const COL3_LABELS = [
    t('svcVerified'),
    t('svcPayment'),
    t('svcGuide'),
    t('svcLandlord'),
    t('svcAgent'),
  ];

  return (
    <footer
      className="border-t border-line/60 shadow-inner"
      style={{ background: 'linear-gradient(to bottom, #fdfcfb, #f5f5f5)' }}
    >
      <div
        aria-hidden
        className="h-0.5 w-full"
        style={{ background: 'linear-gradient(90deg, rgba(250,204,21,0.60), rgba(181,137,0,0.80), transparent)' }}
      />

      <div className="aa-container py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">

          {/* Col 1 — Brand */}
          <div className="space-y-4">
            <Link href="/">
              <Image src="/images/LOGO.png" alt="AlloAppart" width={300} height={85} className="h-20 w-auto" />
            </Link>
            <p className="text-sm leading-relaxed text-sub max-w-55">
              {t('tagline')}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {SOCIALS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  aria-label={s.label}
                  className={`flex h-11 w-11 items-center justify-center rounded-full border border-gray-300 bg-white/60 text-sub transition-all duration-200 hover:scale-110 ${s.color}`}
                >
                  <i className={`${s.icon} text-base`} />
                </a>
              ))}
            </div>
          </div>

          {/* Col 2 — Navigation */}
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-widest text-gold-dark">
              {t('nav')}
            </h4>
            <ul className="space-y-2">
              {COL2.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-sub transition-colors hover:text-gold-dark">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3 — Services */}
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-widest text-gold-dark">
              {t('services')}
            </h4>
            <ul className="space-y-2">
              {COL3_LABELS.map((label) => (
                <li key={label} className="text-sm text-sub">
                  {label}
                </li>
              ))}
            </ul>
          </div>

          {/* Col 4 — Contact */}
          <div>
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-widest text-gold-dark">
              {t('contact')}
            </h4>
            <ul className="space-y-3 text-sm text-sub">
              <li className="flex items-start gap-2">
                <i className="fa-solid fa-location-dot mt-0.5 text-gold-dark shrink-0" />
                <span>{t('address')}</span>
              </li>
              <li className="flex items-center gap-2">
                <i className="fa-solid fa-phone text-gold-dark shrink-0" />
                <a href="tel:+221338001234" className="hover:text-gold-dark transition-colors">
                  +221 33 800 12 34
                </a>
              </li>
              <li className="flex items-center gap-2">
                <i className="fa-solid fa-envelope text-gold-dark shrink-0" />
                <a href="mailto:contact@alloappart.sn" className="hover:text-gold-dark transition-colors">
                  contact@alloappart.sn
                </a>
              </li>
            </ul>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-gold/50 bg-gold-pale px-3 py-1.5 text-xs font-semibold text-gold-dark">
              <i className="fa-solid fa-shield-halved" />
              {t('badge')}
            </div>
          </div>

        </div>

        {/* Bas de footer */}
        <div className="mt-10 border-t border-line pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-sub">
          <p>© {new Date().getFullYear()} AlloAppart. {t('rights')}</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/a-propos"        className="hover:text-gold-dark transition-colors">À propos</Link>
            <Link href="/plan-du-site"    className="hover:text-gold-dark transition-colors">Plan du site</Link>
            <Link href="/confidentialite" className="hover:text-gold-dark transition-colors">{t('privacy')}</Link>
            <Link href="/cgu"             className="hover:text-gold-dark transition-colors">{t('terms')}</Link>
            <Link href="/cookies"         className="hover:text-gold-dark transition-colors">{t('cookies')}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
