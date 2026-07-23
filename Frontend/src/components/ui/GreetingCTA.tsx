'use client';

export default function GreetingCTA({
  firstName,
  fallback,
}: {
  firstName: string | null;
  fallback: string;
}) {
  if (!firstName) return <>{fallback}</>;

  const hour = new Date().getHours();
  const salut =
    hour >= 5 && hour < 12
      ? 'Bonjour'
      : hour >= 12 && hour < 18
        ? 'Bon après-midi'
        : 'Bonsoir';

  return <>{`${salut} ${firstName}`}</>;
}
