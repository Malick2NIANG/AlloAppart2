import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// Id de la session Clerk courante (claim "sid" du JWT), posé par
// ClerkAuthGuard — identifie une connexion précise, distincte d'une autre
// connexion du même utilisateur sur un autre appareil/navigateur. Utilisé
// pour la vérification du code de connexion admin (2FA email), qui doit
// être revalidée à chaque nouvelle session plutôt que mémorisée à vie sur
// le compte, cf. décision du 2026-09-25.
export const CurrentSessionId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ clerkSessionId?: string }>();
    return request.clerkSessionId;
  },
);
