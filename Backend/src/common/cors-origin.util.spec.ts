import { isProductionOriginAllowed } from './cors-origin.util';

describe('cors-origin.util', () => {
  const frontendUrl = 'https://alloappart.sn';

  describe('sans ALLOW_DEV_TUNNELS (comportement actuel)', () => {
    it('accepte exactement FRONTEND_URL', () => {
      expect(
        isProductionOriginAllowed(frontendUrl, {
          frontendUrl,
          allowDevTunnels: false,
        }),
      ).toBe(true);
    });

    it("refuse l'origine d'un tunnel même si elle a la forme attendue", () => {
      expect(
        isProductionOriginAllowed('https://tv1lkfcn-3000.eun1.devtunnels.ms', {
          frontendUrl,
          allowDevTunnels: false,
        }),
      ).toBe(false);
    });

    it('refuse une origine absente (pas de header Origin)', () => {
      expect(
        isProductionOriginAllowed(undefined, {
          frontendUrl,
          allowDevTunnels: false,
        }),
      ).toBe(false);
    });

    it('refuse toute autre origine', () => {
      expect(
        isProductionOriginAllowed('https://evil.example', {
          frontendUrl,
          allowDevTunnels: false,
        }),
      ).toBe(false);
    });
  });

  describe('avec ALLOW_DEV_TUNNELS=true', () => {
    it('accepte toujours FRONTEND_URL', () => {
      expect(
        isProductionOriginAllowed(frontendUrl, {
          frontendUrl,
          allowDevTunnels: true,
        }),
      ).toBe(true);
    });

    it("accepte l'origine du tunnel au motif exact (port 3000)", () => {
      expect(
        isProductionOriginAllowed('https://tv1lkfcn-3000.eun1.devtunnels.ms', {
          frontendUrl,
          allowDevTunnels: true,
        }),
      ).toBe(true);
    });

    it('refuse un autre port de tunnel (4000, 6001 — jamais une origine appelante)', () => {
      expect(
        isProductionOriginAllowed('https://tv1lkfcn-4000.eun1.devtunnels.ms', {
          frontendUrl,
          allowDevTunnels: true,
        }),
      ).toBe(false);
      expect(
        isProductionOriginAllowed('https://tv1lkfcn-6001.eun1.devtunnels.ms', {
          frontendUrl,
          allowDevTunnels: true,
        }),
      ).toBe(false);
    });

    it('refuse un domaine qui ne se termine pas par devtunnels.ms', () => {
      expect(
        isProductionOriginAllowed('https://tv1lkfcn-3000.evil.example', {
          frontendUrl,
          allowDevTunnels: true,
        }),
      ).toBe(false);
    });

    it('refuse en HTTP (non chiffré)', () => {
      expect(
        isProductionOriginAllowed('http://tv1lkfcn-3000.eun1.devtunnels.ms', {
          frontendUrl,
          allowDevTunnels: true,
        }),
      ).toBe(false);
    });

    it('refuse toute autre origine sans rapport', () => {
      expect(
        isProductionOriginAllowed('https://evil.example', {
          frontendUrl,
          allowDevTunnels: true,
        }),
      ).toBe(false);
    });
  });
});
