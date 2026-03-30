import { AuthClient } from '@dfinity/auth-client';

let authClient: AuthClient | null = null;

export async function getAuthClient(): Promise<AuthClient> {
  if (!authClient) {
    authClient = await AuthClient.create();
  }
  return authClient;
}

const isLocal =
  import.meta.env.VITE_IC_HOST?.includes('127.0.0.1') ||
  import.meta.env.VITE_IC_HOST?.includes('localhost');

const II_URL = isLocal
  ? (import.meta.env.VITE_II_URL ?? 'http://uqzsh-gqaaa-aaaaq-qaada-cai.localhost:4943')
  : 'https://identity.ic0.app';

export async function login(): Promise<boolean> {
  const client = await getAuthClient();
  return new Promise((resolve) => {
    client.login({
      identityProvider: II_URL,
      onSuccess: () => resolve(true),
      onError: () => resolve(false),
    });
  });
}

export async function logout(): Promise<void> {
  const client = await getAuthClient();
  await client.logout();
}
