import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import type { User, PaginatedResponse } from '@/types';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { userId, getToken } = await auth();
  if (!userId) redirect('/sign-in');
  const token = await getToken();
  const { page = '1' } = await searchParams;

  const { data: users, total } = await api.get<PaginatedResponse<User>>(
    `/auth/users?page=${page}&limit=20`,
    token ?? undefined,
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text">Utilisateurs</h1>
        <p className="mt-1 text-sm text-sub">{total} utilisateur{total > 1 ? 's' : ''} inscrits</p>
      </div>

      {users.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-pale">
            <i className="fa-solid fa-users text-2xl text-gold-dark" />
          </div>
          <p className="text-sub">Aucun utilisateur trouvé.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {users.map((user) => (
            <div key={user.id} className="rounded-xl border border-line bg-card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-pale">
                  <i className="fa-solid fa-user text-gold-dark text-sm" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-text truncate">{user.firstName} {user.lastName}</p>
                  <p className="text-sm text-sub truncate">{user.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {user.roles.map((role) => (
                  <span key={role} className="text-xs bg-gold-pale text-gold-dark px-2.5 py-1 rounded-full font-medium">
                    {role}
                  </span>
                ))}
                <span className="text-xs text-sub">
                  <i className="fa-regular fa-calendar text-xs mr-1" />
                  {formatDate(user.createdAt)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
      <Pagination page={parseInt(page)} total={total} limit={20} />
    </div>
  );
}

function Pagination({ page, total, limit }: { page: number; total: number; limit: number }) {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-6">
      <Link
        href={`?page=${page - 1}`}
        className={`flex items-center gap-1.5 rounded-lg border border-line bg-card px-4 py-2 text-sm font-medium text-sub transition hover:text-text ${page <= 1 ? 'pointer-events-none opacity-40' : ''}`}
      >
        <i className="fa-solid fa-chevron-left text-xs" /> Précédent
      </Link>
      <span className="text-sm text-sub">Page {page} / {totalPages}</span>
      <Link
        href={`?page=${page + 1}`}
        className={`flex items-center gap-1.5 rounded-lg border border-line bg-card px-4 py-2 text-sm font-medium text-sub transition hover:text-text ${page >= totalPages ? 'pointer-events-none opacity-40' : ''}`}
      >
        Suivant <i className="fa-solid fa-chevron-right text-xs" />
      </Link>
    </div>
  );
}
