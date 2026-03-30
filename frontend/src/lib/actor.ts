import { HttpAgent, Actor, type Identity } from '@dfinity/agent';
import type { _SERVICE } from '../declarations/backend.did.d';
import { idlFactory } from '../declarations/backend.did';

const CANISTER_ID =
  import.meta.env.VITE_BACKEND_CANISTER_ID ??
  import.meta.env.CANISTER_ID_BACKEND ??
  '';

const HOST = import.meta.env.VITE_IC_HOST ?? 'http://127.0.0.1:4943';

export async function createActor(identity?: Identity) {
  const agent = await HttpAgent.create({
    host: HOST,
    identity,
  });

  // Only fetch root key in local development
  if (HOST.includes('127.0.0.1') || HOST.includes('localhost')) {
    await agent.fetchRootKey();
  }

  return Actor.createActor<_SERVICE>(idlFactory, {
    agent,
    canisterId: CANISTER_ID,
  });
}
