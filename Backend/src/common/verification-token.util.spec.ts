import {
  signVerificationToken,
  verifyVerificationToken,
  generateVerificationQrPng,
} from './verification-token.util';

describe('verification-token.util', () => {
  const secret = 'test-secret-key';

  describe('sign/verify — aller-retour', () => {
    it("retourne le bookingId d'origine pour un token valide", () => {
      const token = signVerificationToken('booking-123', secret);
      expect(verifyVerificationToken(token, secret)).toBe('booking-123');
    });

    it('produit un token différent pour deux bookingId différents', () => {
      const t1 = signVerificationToken('booking-1', secret);
      const t2 = signVerificationToken('booking-2', secret);
      expect(t1).not.toBe(t2);
    });

    it('produit le même token pour le même bookingId (stable, sans horodatage)', () => {
      const t1 = signVerificationToken('booking-123', secret);
      const t2 = signVerificationToken('booking-123', secret);
      expect(t1).toBe(t2);
    });
  });

  describe('détection de falsification', () => {
    it('rejette un token dont la signature a été modifiée', () => {
      const token = signVerificationToken('booking-123', secret);
      const [payload] = token.split('.');
      const tampered = `${payload}.signature-forgee`;
      expect(verifyVerificationToken(tampered, secret)).toBeNull();
    });

    it('rejette un token signé avec un secret différent', () => {
      const token = signVerificationToken('booking-123', secret);
      expect(verifyVerificationToken(token, 'autre-secret')).toBeNull();
    });

    it('rejette un token dont le payload a été modifié pour un autre bookingId', () => {
      const token = signVerificationToken('booking-123', secret);
      const [, signature] = token.split('.');
      const otherPayload = Buffer.from('booking-999', 'utf8').toString(
        'base64url',
      );
      const tampered = `${otherPayload}.${signature}`;
      expect(verifyVerificationToken(tampered, secret)).toBeNull();
    });

    it('rejette un token malformé (pas de séparateur)', () => {
      expect(verifyVerificationToken('token-sans-point', secret)).toBeNull();
    });

    it('rejette un token vide', () => {
      expect(verifyVerificationToken('', secret)).toBeNull();
    });

    it('rejette un token avec plusieurs séparateurs', () => {
      expect(verifyVerificationToken('a.b.c', secret)).toBeNull();
    });
  });

  describe('generateVerificationQrPng', () => {
    it('génère un buffer PNG non vide pour une URL', async () => {
      const buffer = await generateVerificationQrPng(
        'https://alloappart.sn/verifier/abc',
      );
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);
      // Signature PNG standard (89 50 4E 47)
      expect(buffer.subarray(0, 4).toString('hex')).toBe('89504e47');
    });
  });
});
