import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminGetUsers, adminSetRole } from '../../api/admin';
import type { UserRole } from '../../types';
import Spinner from '../../components/Spinner';

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: adminGetUsers,
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) => adminSetRole(id, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
    onError: (e: any) => setError(e.userMessage ?? 'Failed to update role'),
  });

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>;

  return (
    <div>
      <h1 className="text-xl font-bold mb-6" style={{ color: '#f0b90b' }}>User Management</h1>
      {error && (
        <div className="mb-4 px-4 py-2 rounded text-sm text-red-400" style={{ background: '#2a1a1a' }}>
          {error}
        </div>
      )}
      <div className="rounded-lg overflow-hidden" style={{ background: '#252930', border: '1px solid #3c4049' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid #3c4049' }}>
              <th className="px-4 py-3 text-left text-gray-400 font-medium">Email</th>
              <th className="px-4 py-3 text-left text-gray-400 font-medium">Role</th>
              <th className="px-4 py-3 text-left text-gray-400 font-medium">ID</th>
              <th className="px-4 py-3 text-left text-gray-400 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {users?.map(user => (
              <tr key={user.id} style={{ borderBottom: '1px solid #3c4049' }}>
                <td className="px-4 py-3 text-gray-100">{user.email}</td>
                <td className="px-4 py-3">
                  <span
                    className="px-2 py-1 rounded text-xs font-semibold"
                    style={{
                      background: user.role === 'ADMIN' ? '#2a1f00' : '#1a2a1a',
                      color: user.role === 'ADMIN' ? '#f0b90b' : '#4ade80',
                    }}
                  >
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs font-mono">{user.id}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => roleMutation.mutate({ id: user.id, role: user.role === 'ADMIN' ? 'USER' : 'ADMIN' })}
                    disabled={roleMutation.isPending}
                    className="px-3 py-1 rounded text-xs font-medium transition-colors disabled:opacity-50"
                    style={{
                      background: user.role === 'ADMIN' ? '#3c4049' : '#2a1f00',
                      color: user.role === 'ADMIN' ? '#d1d5db' : '#f0b90b',
                      border: '1px solid #3c4049',
                    }}
                  >
                    {user.role === 'ADMIN' ? 'Demote to USER' : 'Promote to ADMIN'}
                  </button>
                </td>
              </tr>
            ))}
            {users?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">No users found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
