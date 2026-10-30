import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import MessageRoomRedirect from './MessageRoomRedirect';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
}));

describe('MessageRoomRedirect', () => {
  beforeEach(() => { replace.mockReset(); });

  it('redirige immédiatement vers {basePath}?room={roomId} (bascule vers MessagesShell, pas de duplication d’interface)', () => {
    render(<MessageRoomRedirect roomId="abc123" basePath="/bailleur/messages" />);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/bailleur/messages?room=abc123', { scroll: false });
  });

  it('respecte le basePath propre à chaque espace', () => {
    render(<MessageRoomRedirect roomId="xyz" basePath="/agent/messages" />);
    expect(replace).toHaveBeenCalledWith('/agent/messages?room=xyz', { scroll: false });
  });
});
