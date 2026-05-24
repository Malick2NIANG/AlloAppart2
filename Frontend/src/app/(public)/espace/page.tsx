import EspaceClient from './EspaceClient';

export const metadata = {
  title: 'Mon Espace — AlloAppart',
  description: 'Gérez vos favoris, annonces et messages sur AlloAppart.',
};

export default function EspacePage() {
  return (
    <main className="py-10 px-4 bg-bg min-h-screen">
      <div className="aa-container max-w-5xl">
        <EspaceClient />
      </div>
    </main>
  );
}
