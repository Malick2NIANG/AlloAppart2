'use client';

export default function GreetingHero({ firstName }: { firstName: string }) {
  const hour = new Date().getHours();

  const salut =
    hour >= 5 && hour < 12
      ? 'Bonjour'
      : hour >= 12 && hour < 18
        ? 'Bon après-midi'
        : 'Bonsoir';

  return (
    <>
      {firstName ? (
        <>
          {salut},{' '}
          <span className="mt-1 block bg-linear-to-r from-gold to-gold-light bg-clip-text text-transparent">
            {firstName} !
          </span>
        </>
      ) : (
        <>
          {salut},{' '}
          <span className="mt-1 block bg-linear-to-r from-gold to-gold-light bg-clip-text text-transparent">
            bienvenue !
          </span>
        </>
      )}
    </>
  );
}
