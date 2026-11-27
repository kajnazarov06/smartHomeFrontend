import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/endpoints';
import { disconnectEcho } from '../lib/echo';
import { qk } from './keys';

export function useUser() {
  return useQuery({
    queryKey: qk.user,
    queryFn: async () => {
      try {
        return await api.me();
      } catch (err) {
        if (err.status === 401) return null;
        throw err;
      }
    },
    staleTime: Infinity,
    retry: (count, err) => err.status === 0 && count < 2,
  });
}

export function useAuthStatus() {
  return useQuery({ queryKey: qk.authStatus, queryFn: api.authStatus, staleTime: 60_000, retry: 1 });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.login,
    onSuccess: (user) => qc.setQueryData(qk.user, user),
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.register,
    onSuccess: (user) => {
      qc.setQueryData(qk.user, user);
      qc.invalidateQueries({ queryKey: qk.authStatus });
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.logout,
    onSettled: () => {
      disconnectEcho();
      qc.clear();
      qc.setQueryData(qk.user, null);
    },
  });
}
