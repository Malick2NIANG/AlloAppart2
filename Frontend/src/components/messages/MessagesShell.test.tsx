import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MessagesShell from './MessagesShell';
import type { MessageRoom, Message, User } from '@/types';

const push    = vi.fn();
const replace = vi.fn();
const back    = vi.fn();
let params = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace, back }),
  useSearchParams: () => params,
  usePathname: () => '/locataire/messages',
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key,
  useLocale: () => 'fr',
}));

// getToken DOIT être une référence stable entre les rendus (comme le vrai
// useAuth() de Clerk) : un nouveau vi.fn() à chaque appel casserait la
// stabilité de useCallback([getToken]) dans MessagesShell (loadMessages),
// provoquant une boucle infinie effet→setMessages([])→re-rendu→nouvel
// effet… (le composant lui-même est correct : aucun souci en navigateur
// réel, où Clerk garantit cette stabilité — cf. rapport, ce mock instable a
// coûté l'essentiel du temps de ce lot avant d'être repéré).
const getToken = vi.fn().mockResolvedValue('fake-token');
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken }),
}));

// pusher-js : non pertinent pour ces tests (pas de vrai serveur temps réel) —
// un client inoffensif qui ne déclenche jamais d'évènement.
vi.mock('pusher-js', () => ({
  default: vi.fn().mockImplementation(() => ({
    subscribe: () => ({ bind: vi.fn(), unbind_all: vi.fn() }),
    unsubscribe: vi.fn(),
    disconnect: vi.fn(),
  })),
}));
// Frontend/.env.local (chargé par Vite/Vitest, pas seulement les variables
// VITE_*) définit NEXT_PUBLIC_SOKETI_APP_KEY pour le Soketi réel du Docker —
// vidée ici pour que MessagesShell ne tente jamais une vraie connexion
// WebSocket pendant les tests (le mock ci-dessus intercepte l'import, mais
// le composant ne construit un client que si la clé est non vide).
process.env.NEXT_PUBLIC_SOKETI_APP_KEY = '';

const apiGet = vi.fn();
vi.mock('@/lib/api', () => ({
  api: {
    get: (...args: unknown[]) => apiGet(...args),
    post: vi.fn().mockResolvedValue({}),
    patch: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
}));

const ME: User = { id: 'me', firstName: 'Moi', lastName: 'Test', roles: ['LOCATAIRE'] } as User;

function makeRoom(id: string, overrides: Partial<MessageRoom> = {}): MessageRoom {
  return {
    id,
    listingId: `listing-${id}`,
    listing: { title: `Annonce ${id}` } as MessageRoom['listing'],
    participants: [ME, { id: `other-${id}`, firstName: 'Bailleur', lastName: id, roles: ['BAILLEUR'] } as User],
    messages: [{ id: `m-${id}`, content: 'dernier message', senderId: `other-${id}`, createdAt: new Date().toISOString(), readAt: null } as Message],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function mockApiSequence(rooms: MessageRoom[], messages: Message[] = []) {
  apiGet.mockImplementation((path: string) => {
    if (path === '/auth/me') return Promise.resolve(ME);
    if (path === '/messages/rooms') return Promise.resolve(rooms);
    if (path.startsWith('/messages/rooms/')) return Promise.resolve(messages);
    return Promise.resolve([]);
  });
}

describe('MessagesShell — mode application mobile', () => {
  beforeEach(() => {
    push.mockReset();
    replace.mockReset();
    back.mockReset();
    apiGet.mockReset();
    getToken.mockResolvedValue('fake-token');
    params = new URLSearchParams();
  });

  it('sans ?room= : affiche la liste, pas de conversation ouverte (jamais la première room auto-ouverte)', async () => {
    mockApiSequence([makeRoom('a'), makeRoom('b')]);
    render(<MessagesShell />);
    await waitFor(() => expect(screen.getByText('Bailleur a')).toBeInTheDocument());
    expect(screen.getByText('Bailleur b')).toBeInTheDocument();
    // Aucun en-tête de conversation ouvert : pas de flèche retour affichée.
    expect(screen.queryByLabelText('backToConversations')).not.toBeInTheDocument();
  });

  it('?room=<id> dans l’URL ouvre directement cette conversation', async () => {
    params = new URLSearchParams({ room: 'a' });
    mockApiSequence([makeRoom('a'), makeRoom('b')], [
      { id: 'm1', content: 'Bonjour', senderId: 'other-a', createdAt: new Date().toISOString(), readAt: null } as Message,
    ]);
    render(<MessagesShell />);
    await waitFor(() => expect(screen.getByText('Bonjour')).toBeInTheDocument());
  });

  it('ouvrir une conversation depuis la liste pousse ?room= (entrée d’historique)', async () => {
    mockApiSequence([makeRoom('a')], []);
    const user = userEvent.setup();
    render(<MessagesShell />);
    await waitFor(() => expect(screen.getByText('Bailleur a')).toBeInTheDocument());
    await user.click(screen.getByText('Bailleur a'));
    expect(push).toHaveBeenCalledWith('/locataire/messages?room=a', { scroll: false });
  });

  it('flèche retour de la conversation ferme vers la liste (router.back si ouverte par un lien direct)', async () => {
    // Lien direct ?room=a (cas « bootstrap ») : pushedHistoryRef est mis à
    // true par l'effet de bootstrap au montage, donc la flèche retour doit
    // appeler router.back().
    params = new URLSearchParams({ room: 'a' });
    mockApiSequence([makeRoom('a')], []);
    const user = userEvent.setup();
    render(<MessagesShell />);
    const backBtn = await screen.findByLabelText('backToConversations');
    await user.click(backBtn);
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('pastille de non-lu visible pour un message reçu non lu, absente sinon', async () => {
    const unread = makeRoom('unread', {
      messages: [{ id: 'm', content: 'non lu', senderId: 'other-unread', createdAt: new Date().toISOString(), readAt: null } as Message],
    });
    const read = makeRoom('read', {
      messages: [{ id: 'm2', content: 'lu', senderId: 'other-read', createdAt: new Date().toISOString(), readAt: new Date().toISOString() } as Message],
    });
    mockApiSequence([unread, read]);
    render(<MessagesShell />);
    await waitFor(() => expect(screen.getByText('Bailleur unread')).toBeInTheDocument());
    // La pastille rouge "1" n'apparaît que pour la conversation non lue.
    const unreadRow = screen.getByText('Bailleur unread').closest('[role="button"]')!;
    const readRow   = screen.getByText('Bailleur read').closest('[role="button"]')!;
    expect(unreadRow.textContent).toContain('1');
    expect(readRow.textContent).not.toMatch(/\b1\b/);
  });

  it('séparateur de date affiché une fois par jour distinct, jamais entre deux messages du même jour', async () => {
    params = new URLSearchParams({ room: 'a' });
    const today = new Date();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    mockApiSequence([makeRoom('a')], [
      { id: 'm1', content: 'Hier msg', senderId: 'other-a', createdAt: yesterday.toISOString(), readAt: null } as Message,
      { id: 'm2', content: 'Aujourd’hui msg 1', senderId: 'other-a', createdAt: today.toISOString(), readAt: null } as Message,
      { id: 'm3', content: 'Aujourd’hui msg 2', senderId: 'me', createdAt: today.toISOString(), readAt: null } as Message,
    ]);
    render(<MessagesShell />);
    await waitFor(() => expect(screen.getByText('Hier msg')).toBeInTheDocument());
    // 2 jours distincts (hier, aujourd'hui) → 2 séparateurs de date, pas 3
    // (un par message) : le wrapper qui centre chaque séparateur est unique
    // à ce rendu (my-3, utilisé nulle part ailleurs dans ce composant).
    const separators = document.querySelectorAll('.my-3');
    expect(separators.length).toBe(2);
  });
});
