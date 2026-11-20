import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LanguageToggle from './LanguageToggle';

const push = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

const setLocale = vi.fn();
vi.mock('@/i18n/actions', () => ({
  setLocale: (...args: unknown[]) => setLocale(...args),
}));

const writeLocaleCookie = vi.fn();
vi.mock('@/i18n/clientLocale', () => ({
  writeLocaleCookie: (...args: unknown[]) => writeLocaleCookie(...args),
}));

let pending = false;
vi.mock('./LocaleTransition', () => ({
  useLocaleTransition: () => ({
    pending,
    run: (action: () => Promise<void> | void) => { void action(); },
  }),
}));

describe('LanguageToggle (lot « mobile : langue, dark mode, photo originale »)', () => {
  beforeEach(() => {
    pending = false;
    push.mockReset();
    refresh.mockReset();
    setLocale.mockReset().mockResolvedValue(undefined);
    writeLocaleCookie.mockReset();
  });

  it('FR actif : bascule vers EN au clic — cookie écrit AVANT setLocale, puis router.refresh()', async () => {
    const user = userEvent.setup();
    render(<LanguageToggle currentLocale="fr" />);

    expect(screen.getByRole('radio', { name: 'Français', checked: true })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'English', checked: false })).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'English' }));

    expect(writeLocaleCookie).toHaveBeenCalledWith('en');
    expect(setLocale).toHaveBeenCalledWith('en');
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('EN actif : bascule vers FR au clic', async () => {
    const user = userEvent.setup();
    render(<LanguageToggle currentLocale="en" />);

    expect(screen.getByRole('radio', { name: 'English', checked: true })).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Français' }));

    expect(writeLocaleCookie).toHaveBeenCalledWith('fr');
    expect(setLocale).toHaveBeenCalledWith('fr');
  });

  it('clic sur la langue déjà active : sans effet (ni cookie, ni action, ni refresh)', async () => {
    const user = userEvent.setup();
    render(<LanguageToggle currentLocale="fr" />);

    await user.click(screen.getByRole('radio', { name: 'Français' }));

    expect(writeLocaleCookie).not.toHaveBeenCalled();
    expect(setLocale).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('pendant "pending" : les deux boutons sont désactivés, le clic ne fait rien', async () => {
    pending = true;
    const user = userEvent.setup();
    render(<LanguageToggle currentLocale="fr" />);

    const enButton = screen.getByRole('radio', { name: 'English' });
    expect(enButton).toBeDisabled();

    await user.click(enButton);
    expect(writeLocaleCookie).not.toHaveBeenCalled();
  });

  it('setLocale qui échoue n\'empêche pas router.refresh() (la langue est déjà changée via le cookie)', async () => {
    setLocale.mockRejectedValue(new Error('refused'));
    const user = userEvent.setup();
    render(<LanguageToggle currentLocale="fr" />);

    await user.click(screen.getByRole('radio', { name: 'English' }));

    expect(writeLocaleCookie).toHaveBeenCalledWith('en');
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
