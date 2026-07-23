import MessagesShell from '@/components/messages/MessagesShell';

export default function LocataireMessagesPage() {
  return (
    <div className="-m-4 sm:-m-6 lg:-m-8 h-[calc(100vh-3.5rem)] overflow-hidden">
      <MessagesShell emptyHint="Contactez un bailleur depuis une annonce pour démarrer." />
    </div>
  );
}
