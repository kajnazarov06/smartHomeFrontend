import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/endpoints';
import { disconnectEcho } from '../lib/echo';

export function useUser() {
  return useQuery({
    queryKey: ['user'],
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
  return useQuery({ queryKey: ['auth-status'], queryFn: api.authStatus, staleTime: 60_000, retry: 1 });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.login,
    onSuccess: (user) => qc.setQueryData(['user'], user),
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.register,
    onSuccess: (user) => {
      qc.setQueryData(['user'], user);
      qc.invalidateQueries({ queryKey: ['auth-status'] });
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
      qc.setQueryData(['user'], null);
    },
  });
}
