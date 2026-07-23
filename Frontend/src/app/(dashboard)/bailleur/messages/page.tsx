import MessagesShell from '@/components/messages/MessagesShell';

export default function BailleurMessagesPage() {
  return (
    <div className="-m-4 sm:-m-6 lg:-m-8 h-[calc(100vh-3.5rem)] overflow-hidden">
      <MessagesShell emptyHint="Les messages de vos locataires apparaîtront ici." />
    </div>
  );
}
