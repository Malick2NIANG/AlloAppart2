import Navbar from '@/components/ui/Navbar';
import Footer from '@/components/ui/Footer';
import PublicSkeletonOverlay from '@/components/ui/PublicSkeletonOverlay';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <div className="flex-1">{children}</div>
      <Footer />
      <PublicSkeletonOverlay />
    </>
  );
}
