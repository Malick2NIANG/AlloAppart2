import { describe, it, expect, afterEach } from 'vitest';
import { writeLocaleCookie } from './clientLocale';

function clearCookies() {
  // jsdom ne fournit pas de vidage natif : expire chaque cookie connu.
  document.cookie.split(';').forEach((c) => {
    const name = c.split('=')[0]?.trim();
    if (name) document.cookie = `${name}=;Path=/;Max-Age=0`;
  });
}

describe('writeLocaleCookie (lot « mobile : langue, dark mode, photo originale »)', () => {
  afterEach(() => clearCookies());

  it('écrit le cookie allo-locale avec la valeur donnée', () => {
    writeLocaleCookie('en');
    expect(document.cookie).toMatch(/allo-locale=en/);
  });

  it('Max-Age correspond à un an (31536000 s)', () => {
    const setCookieSpy: string[] = [];
    const original = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie')!;
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () => original.get!.call(document),
      set: (v: string) => { setCookieSpy.push(v); original.set!.call(document, v); },
    });

    writeLocaleCookie('fr');

    expect(setCookieSpy[0]).toMatch(/Max-Age=31536000/);
    Object.defineProperty(document, 'cookie', original);
  });

  it('Secure uniquement en https', () => {
    const httpsDescriptor = Object.getOwnPropertyDescriptor(window, 'location')!;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, protocol: 'https:' },
    });

    const setCookieSpy: string[] = [];
    const original = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie')!;
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () => original.get!.call(document),
      set: (v: string) => { setCookieSpy.push(v); original.set!.call(document, v); },
    });

    writeLocaleCookie('en');
    expect(setCookieSpy[0]).toMatch(/; Secure/);

    Object.defineProperty(document, 'cookie', original);
    Object.defineProperty(window, 'location', httpsDescriptor);
  });

  it('pas de Secure en http', () => {
    const setCookieSpy: string[] = [];
    const original = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie')!;
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () => original.get!.call(document),
      set: (v: string) => { setCookieSpy.push(v); original.set!.call(document, v); },
    });

    writeLocaleCookie('fr');
    expect(setCookieSpy[0]).not.toMatch(/Secure/);

    Object.defineProperty(document, 'cookie', original);
  });

  it('Path=/ et SameSite=Lax (mêmes attributs que la Server Action setLocale)', () => {
    const setCookieSpy: string[] = [];
    const original = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie')!;
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () => original.get!.call(document),
      set: (v: string) => { setCookieSpy.push(v); original.set!.call(document, v); },
    });

    writeLocaleCookie('en');

    expect(setCookieSpy[0]).toMatch(/Path=\//);
    expect(setCookieSpy[0]).toMatch(/SameSite=Lax/);
    Object.defineProperty(document, 'cookie', original);
  });
});
