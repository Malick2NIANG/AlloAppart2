'use client';

export default function Greeting({ firstName }: { firstName: string }) {
  const hour = new Date().getHours();

  const salut =
    hour >= 5 && hour < 12
      ? 'Bonjour'
      : hour >= 12 && hour < 18
        ? 'Bon après-midi'
        : 'Bonsoir';

  return (
    <h1 className="text-2xl font-bold text-text">
      {salut}, {firstName}
    </h1>
  );
}
