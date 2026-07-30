import { clerkMiddleware } from '@clerk/nextjs/server';

// clerkMiddleware() sans logique de redirection :
// - injecte l'état auth dans les Server Components (auth() fonctionne)
// - ne redirige PAS les routes non-authentifiées (la redirection est gérée par les pages elles-mêmes)
export default clerkMiddleware();

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
