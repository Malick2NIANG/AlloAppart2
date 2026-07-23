import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/listings(.*)',
  '/regions(.*)',
  '/search(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/a-propos(.*)',
  '/confidentialite(.*)',
  '/cgu(.*)',
  '/cookies(.*)',
  '/plan-du-site(.*)',
  '/espace(.*)',
  '/onboarding(.*)',
  '/messages(.*)',
  '/profil(.*)',
  '/publier(.*)',
  '/api/webhooks(.*)',
  '/agences(.*)',
  '/redirect',
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
