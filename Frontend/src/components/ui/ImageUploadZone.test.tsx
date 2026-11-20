import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ImageUploadZone from './ImageUploadZone';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key}(${JSON.stringify(params)})` : key,
}));

vi.mock('@/lib/runtimeUrls', () => ({
  getApiBaseUrl: () => 'http://api.test',
}));

// Double minimal de PhotoCropper : expose directement onConfirm/onCancel via
// deux boutons, sans dépendre du vrai cropper (canvas/pointer events).
vi.mock('./PhotoCropper', () => ({
  default: ({ onConfirm, onCancel }: { onConfirm: (b: Blob) => void; onCancel: () => void }) => (
    <div data-testid="photo-cropper">
      <button type="button" onClick={() => onConfirm(new Blob(['cropped'], { type: 'image/jpeg' }))}>
        confirm-crop
      </button>
      <button type="button" onClick={onCancel}>cancel-crop</button>
    </div>
  ),
}));

// `compressImage` lit les dimensions réelles du fichier via createImageBitmap,
// indisponible en jsdom — stub minimal : renvoie le fichier tel quel.
Object.defineProperty(global, 'createImageBitmap', {
  value: vi.fn().mockRejectedValue(new Error('unsupported in jsdom')),
  writable: true,
});

const getToken = vi.fn().mockResolvedValue('token-123');

function makeFile(name = 'photo.jpg') {
  return new File(['x'.repeat(100)], name, { type: 'image/jpeg' });
}

describe('ImageUploadZone — photo originale (lot « mobile : langue, dark mode, photo originale »)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getToken.mockClear();
    let call = 0;
    fetchMock = vi.fn().mockImplementation(async () => {
      call += 1;
      return {
        ok: true,
        json: async () => ({ url: `https://res.cloudinary.com/demo/upload-${call}.jpg` }),
        text: async () => '',
      };
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('confirmation du recadrage : deux envois (cadré + original), onOriginalsChange reçoit { cadré: original }', async () => {
    const onChange = vi.fn();
    const onOriginalsChange = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <ImageUploadZone
        images={[]}
        onChange={onChange}
        getToken={getToken}
        originals={{}}
        onOriginalsChange={onOriginalsChange}
      />,
    );

    const fileInput = container.querySelector('input[type="file"]:not([capture])') as HTMLInputElement;
    await user.upload(fileInput, makeFile());

    await screen.findByTestId('photo-cropper');
    await user.click(screen.getByText('confirm-crop'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(onOriginalsChange).toHaveBeenCalledWith({
        'https://res.cloudinary.com/demo/upload-1.jpg': 'https://res.cloudinary.com/demo/upload-2.jpg',
      }),
    );
    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith(['https://res.cloudinary.com/demo/upload-1.jpg']),
    );
  });

  it("l'envoi de l'original échoue : la photo cadrée est quand même publiée, pas d'entrée dans la table", async () => {
    let call = 0;
    fetchMock = vi.fn().mockImplementation(async () => {
      call += 1;
      if (call === 1) {
        return { ok: true, json: async () => ({ url: 'https://res.cloudinary.com/demo/cropped.jpg' }), text: async () => '' };
      }
      return { ok: false, text: async () => 'upload failed' };
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const onChange = vi.fn();
    const onOriginalsChange = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <ImageUploadZone
        images={[]}
        onChange={onChange}
        getToken={getToken}
        originals={{}}
        onOriginalsChange={onOriginalsChange}
      />,
    );

    const fileInput = container.querySelector('input[type="file"]:not([capture])') as HTMLInputElement;
    await user.upload(fileInput, makeFile());
    await screen.findByTestId('photo-cropper');
    await user.click(screen.getByText('confirm-crop'));

    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith(['https://res.cloudinary.com/demo/cropped.jpg']),
    );
    expect(onOriginalsChange).toHaveBeenLastCalledWith({});
  });

  it('retirer une photo retire son entrée de la table des originaux', async () => {
    const onChange = vi.fn();
    const onOriginalsChange = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <ImageUploadZone
        images={['https://res.cloudinary.com/demo/cropped.jpg']}
        onChange={onChange}
        getToken={getToken}
        originals={{ 'https://res.cloudinary.com/demo/cropped.jpg': 'https://res.cloudinary.com/demo/original.jpg' }}
        onOriginalsChange={onOriginalsChange}
      />,
    );
    void container;

    const removeButton = document.querySelector('button.absolute.right-1') as HTMLElement;
    await user.click(removeButton);

    await waitFor(() => expect(onOriginalsChange).toHaveBeenCalledWith({}));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('« Ajuster » (recadrage a posteriori) conserve le lien vers l\'original sous la nouvelle URL cadrée', async () => {
    let call = 0;
    fetchMock = vi.fn().mockImplementation(async () => {
      call += 1;
      return {
        ok: true,
        json: async () => ({ url: `https://res.cloudinary.com/demo/re-cropped-${call}.jpg` }),
        text: async () => '',
      };
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const onChange = vi.fn();
    const onOriginalsChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ImageUploadZone
        images={['https://res.cloudinary.com/demo/cropped.jpg']}
        onChange={onChange}
        getToken={getToken}
        originals={{ 'https://res.cloudinary.com/demo/cropped.jpg': 'https://res.cloudinary.com/demo/original.jpg' }}
        onOriginalsChange={onOriginalsChange}
      />,
    );

    const adjustButton = screen.getByText('adjustLabel').closest('button') as HTMLElement;
    await user.click(adjustButton);
    await screen.findByTestId('photo-cropper');
    await user.click(screen.getByText('confirm-crop'));

    await waitFor(() =>
      expect(onOriginalsChange).toHaveBeenLastCalledWith({
        'https://res.cloudinary.com/demo/re-cropped-1.jpg': 'https://res.cloudinary.com/demo/original.jpg',
      }),
    );
  });

  it('sans onOriginalsChange : un seul envoi (pas d\'upload d\'original)', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <ImageUploadZone images={[]} onChange={onChange} getToken={getToken} />,
    );

    const fileInput = container.querySelector('input[type="file"]:not([capture])') as HTMLInputElement;
    await user.upload(fileInput, makeFile());
    await screen.findByTestId('photo-cropper');
    await user.click(screen.getByText('confirm-crop'));

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
