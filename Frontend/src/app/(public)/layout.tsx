import { auth } from '@clerk/nextjs/server';
import Navbar from '@/components/ui/Navbar';
import Footer from '@/components/ui/Footer';
import PublicSkeletonOverlay from '@/components/ui/PublicSkeletonOverlay';
import BottomNav from '@/components/ui/BottomNav';
import { getBottomNavItems } from '@/lib/getBottomNavItems';

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  const { items } = getBottomNavItems([], !!userId);

  return (
    <>
      <Navbar />
      <div className="flex-1">{children}</div>
      <Footer />
      <PublicSkeletonOverlay />
      <BottomNav items={items} />
    </>
  );
}
