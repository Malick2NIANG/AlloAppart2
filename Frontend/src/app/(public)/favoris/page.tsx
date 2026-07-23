import { redirect } from 'next/navigation';

export default function FavorisRedirect() {
  redirect('/listings?tab=favoris');
}
