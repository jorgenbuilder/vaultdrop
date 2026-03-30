import { useState, useEffect, useCallback } from 'react';
import type { Identity } from '@dfinity/agent';
import { getAuthClient, login as doLogin, logout as doLogout } from '../lib/auth';
import { createActor } from '../lib/actor';
import type { _SERVICE } from '../declarations/backend.did.d';

export function useAuth() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [actor, setActor] = useState<_SERVICE | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  const refreshAuth = useCallback(async () => {
    const client = await getAuthClient();
    const authed = await client.isAuthenticated();
    setIsAuthenticated(authed);
    if (authed) {
      const id = client.getIdentity();
      setIdentity(id);
      const a = await createActor(id);
      setActor(a);
    } else {
      setIdentity(null);
      // Create anonymous actor for claiming
      const a = await createActor();
      setActor(a);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  const login = useCallback(async () => {
    const success = await doLogin();
    if (success) await refreshAuth();
    return success;
  }, [refreshAuth]);

  const logout = useCallback(async () => {
    await doLogout();
    await refreshAuth();
  }, [refreshAuth]);

  return { identity, actor, isAuthenticated, loading, login, logout };
}
