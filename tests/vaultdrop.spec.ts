import { describe, beforeAll, afterAll, it, expect, inject } from 'vitest';
import { PocketIc, type Actor, SubnetStateType } from '@dfinity/pic';
import { Principal } from '@dfinity/principal';
import { IDL } from '@dfinity/candid';
import { TransportSecretKey } from '@dfinity/vetkeys';
import { resolve } from 'path';

// Generated declarations
import type { _SERVICE } from '../.dfx/local/canisters/backend/service.did.d.ts';
const { idlFactory, init } = await import(
  '../.dfx/local/canisters/backend/service.did.js'
);

const WASM_PATH = resolve(
  import.meta.dirname,
  '..',
  '.dfx',
  'local',
  'canisters',
  'backend',
  'backend.wasm',
);

// Test identities (arbitrary principals for testing)
const ALICE_PRINCIPAL = Principal.fromUint8Array(new Uint8Array([1, 1, 1]));
const BOB_PRINCIPAL = Principal.fromUint8Array(new Uint8Array([2, 2, 2]));
const EVE_PRINCIPAL = Principal.fromUint8Array(new Uint8Array([3, 3, 3]));

// Simulate H(drop_secret) — in production this is SHA-256 of the magic link secret
const CORRECT_SECRET_HASH = new Uint8Array(32);
CORRECT_SECRET_HASH.fill(0xaa);

const WRONG_SECRET_HASH = new Uint8Array(32);
WRONG_SECRET_HASH.fill(0xbb);

// Generate valid BLS12-381 transport keys
const TSK = TransportSecretKey.random();
const TRANSPORT_KEY = TSK.publicKeyBytes();

const TSK2 = TransportSecretKey.random();
const TRANSPORT_KEY_2 = TSK2.publicKeyBytes();

const SAMPLE_ENCRYPTED_DATA = new TextEncoder().encode(
  'this-is-encrypted-ciphertext-blob',
);
const SAMPLE_CREATOR_ENCRYPTED_DATA = new TextEncoder().encode(
  'creator-encrypted-ciphertext-blob',
);

/** Helper: create a drop with both ciphertexts */
async function createDrop(
  actor: Actor<_SERVICE>,
  title: string,
  maxClaims: bigint,
  expiresAt: [] | [bigint] = [],
) {
  return actor.create_drop(
    title,
    SAMPLE_ENCRYPTED_DATA,
    SAMPLE_CREATOR_ENCRYPTED_DATA,
    maxClaims,
    expiresAt,
  );
}

describe('VaultDrop Security & Privacy', () => {
  let pic: PocketIc;
  let canisterId: Principal;

  let aliceActor: Actor<_SERVICE>;
  let bobActor: Actor<_SERVICE>;
  let eveActor: Actor<_SERVICE>;
  let anonActor: Actor<_SERVICE>;

  beforeAll(async () => {
    pic = await PocketIc.create(inject('PIC_URL'), {
      ii: { state: { type: SubnetStateType.New } },
      application: [{ state: { type: SubnetStateType.New } }],
    });

    const initArgTypes = init({ IDL });
    const arg = IDL.encode(initArgTypes, ['dfx_test_key']);

    const fixture = await pic.setupCanister<_SERVICE>({
      idlFactory,
      wasm: WASM_PATH,
      arg: new Uint8Array(arg),
      sender: ALICE_PRINCIPAL,
    });

    canisterId = fixture.canisterId;

    aliceActor = fixture.actor;
    aliceActor.setPrincipal(ALICE_PRINCIPAL);

    bobActor = pic.createActor<_SERVICE>(idlFactory, canisterId);
    bobActor.setPrincipal(BOB_PRINCIPAL);

    eveActor = pic.createActor<_SERVICE>(idlFactory, canisterId);
    eveActor.setPrincipal(EVE_PRINCIPAL);

    anonActor = pic.createActor<_SERVICE>(idlFactory, canisterId);
  });

  afterAll(async () => {
    await pic.tearDown();
  });

  // -------------------------------------------------------
  // 1. Basic CRUD
  // -------------------------------------------------------

  describe('Drop creation', () => {
    it('should create a drop and return an id', async () => {
      const id = await createDrop(aliceActor, 'Test Drop', 1n);
      expect(id).toBe('0');
    });

    it('should reject anonymous callers', async () => {
      await expect(createDrop(anonActor, 'Anon Drop', 1n)).rejects.toThrow();
    });

    it('should reject max_claims of 0', async () => {
      await expect(createDrop(aliceActor, 'Zero Drop', 0n)).rejects.toThrow();
    });
  });

  describe('Drop info', () => {
    it('should return metadata for existing drop', async () => {
      const id = await createDrop(aliceActor, 'Info Drop', 5n);
      const info = await aliceActor.get_drop_info(id);
      expect(info).toHaveLength(1);
      const drop = info[0]!;
      expect(drop.title).toBe('Info Drop');
      expect(drop.max_claims).toBe(5n);
      expect(drop.claims).toBe(0n);
    });

    it('should return empty for nonexistent drop', async () => {
      const info = await aliceActor.get_drop_info('99999');
      expect(info).toHaveLength(0);
    });

    it('should NOT expose encrypted data in metadata', async () => {
      const id = await createDrop(aliceActor, 'Secret Drop', 1n);
      const info = await aliceActor.get_drop_info(id);
      const drop = info[0]!;
      expect((drop as any).encrypted_data).toBeUndefined();
      expect((drop as any).creator_encrypted_data).toBeUndefined();
    });
  });

  // -------------------------------------------------------
  // 2. Access control: list_my_drops isolation
  // -------------------------------------------------------

  describe('Drop listing isolation', () => {
    it('should only list drops created by the caller', async () => {
      await createDrop(aliceActor, 'Alice Only', 1n);
      await createDrop(bobActor, 'Bob Only', 1n);

      const aliceDrops = await aliceActor.list_my_drops();
      const bobDrops = await bobActor.list_my_drops();
      const eveDrops = await eveActor.list_my_drops();

      expect(aliceDrops.every((d) => d.title !== 'Bob Only')).toBe(true);
      expect(bobDrops.every((d) => d.title !== 'Alice Only')).toBe(true);
      expect(eveDrops).toHaveLength(0);
    });
  });

  // -------------------------------------------------------
  // 3. Claim rate limiting: max_claims enforcement
  // -------------------------------------------------------

  describe('Max claims enforcement', () => {
    it('should allow exactly max_claims claims then reject', async () => {
      const id = await createDrop(aliceActor, 'Limited Drop', 2n);

      const r1 = await bobActor.claim_drop(id, CORRECT_SECRET_HASH, TRANSPORT_KEY);
      expect('ok' in r1).toBe(true);

      const r2 = await eveActor.claim_drop(id, CORRECT_SECRET_HASH, TRANSPORT_KEY);
      expect('ok' in r2).toBe(true);

      const r3 = await bobActor.claim_drop(id, CORRECT_SECRET_HASH, TRANSPORT_KEY);
      expect('err' in r3).toBe(true);
      if ('err' in r3) {
        expect(r3.err).toBe('Max claims reached');
      }

      const info = await aliceActor.get_drop_info(id);
      expect(info[0]!.claims).toBe(2n);
    });
  });

  // -------------------------------------------------------
  // 4. Expiry enforcement
  // -------------------------------------------------------

  describe('Expiry enforcement', () => {
    it('should reject claims on expired drops', async () => {
      const probeId = await createDrop(aliceActor, 'Probe', 1n);
      const probeInfo = await aliceActor.get_drop_info(probeId);
      const currentTime = probeInfo[0]!.created_at;

      const expiresAt = currentTime + 2_000_000_000n;
      const id = await createDrop(aliceActor, 'Expired Drop', 10n, [expiresAt]);

      await pic.advanceTime(10_000);
      await pic.tick();

      const result = await bobActor.claim_drop(id, CORRECT_SECRET_HASH, TRANSPORT_KEY);
      expect('err' in result).toBe(true);
      if ('err' in result) {
        expect(result.err).toBe('Drop expired');
      }
    });
  });

  // -------------------------------------------------------
  // 5. Core security: wrong secret → different key
  // -------------------------------------------------------

  describe('Cryptographic access control', () => {
    it('should return different encrypted keys for different derivation hashes', async () => {
      const id = await createDrop(aliceActor, 'Crypto Drop', 10n);

      const r1 = await bobActor.claim_drop(id, CORRECT_SECRET_HASH, TRANSPORT_KEY);
      const r2 = await eveActor.claim_drop(id, WRONG_SECRET_HASH, TRANSPORT_KEY);

      expect('ok' in r1).toBe(true);
      expect('ok' in r2).toBe(true);

      if ('ok' in r1 && 'ok' in r2) {
        const key1 = new Uint8Array(r1.ok.encrypted_key);
        const key2 = new Uint8Array(r2.ok.encrypted_key);
        expect(key1).not.toEqual(key2);

        const data1 = new Uint8Array(r1.ok.encrypted_data);
        const data2 = new Uint8Array(r2.ok.encrypted_data);
        expect(data1).toEqual(data2);
      }
    });

    it('should return same encrypted key for same derivation hash (deterministic)', async () => {
      const id = await createDrop(aliceActor, 'Deterministic Drop', 10n);

      const r1 = await bobActor.claim_drop(id, CORRECT_SECRET_HASH, TRANSPORT_KEY);
      const r2 = await eveActor.claim_drop(id, CORRECT_SECRET_HASH, TRANSPORT_KEY);

      expect('ok' in r1).toBe(true);
      expect('ok' in r2).toBe(true);

      if ('ok' in r1 && 'ok' in r2) {
        const key1 = new Uint8Array(r1.ok.encrypted_key);
        const key2 = new Uint8Array(r2.ok.encrypted_key);
        expect(key1).toEqual(key2);
      }
    });
  });

  // -------------------------------------------------------
  // 6. Data privacy: encrypted data is opaque
  // -------------------------------------------------------

  describe('Data privacy', () => {
    it('should store and return encrypted data without modification', async () => {
      const sensitiveData = new TextEncoder().encode('super-secret');
      const creatorData = new TextEncoder().encode('creator-copy');
      const id = await aliceActor.create_drop(
        'Privacy Drop',
        sensitiveData,
        creatorData,
        1n,
        [],
      );

      const result = await bobActor.claim_drop(id, CORRECT_SECRET_HASH, TRANSPORT_KEY);

      expect('ok' in result).toBe(true);
      if ('ok' in result) {
        expect(new Uint8Array(result.ok.encrypted_data)).toEqual(sensitiveData);
      }
    });
  });

  // -------------------------------------------------------
  // 7. Nonexistent drop
  // -------------------------------------------------------

  describe('Nonexistent drops', () => {
    it('should reject claims on nonexistent drops', async () => {
      const result = await bobActor.claim_drop(
        'does-not-exist',
        CORRECT_SECRET_HASH,
        TRANSPORT_KEY,
      );
      expect('err' in result).toBe(true);
      if ('err' in result) {
        expect(result.err).toBe('Drop not found');
      }
    });
  });

  // -------------------------------------------------------
  // 8. Verification key availability
  // -------------------------------------------------------

  describe('Verification key', () => {
    it('should return a non-empty verification key', async () => {
      const vk = await aliceActor.get_verification_key();
      expect(vk.length).toBeGreaterThan(0);
    });

    it('should return the same key across calls (stable)', async () => {
      const vk1 = await aliceActor.get_verification_key();
      const vk2 = await bobActor.get_verification_key();
      expect(new Uint8Array(vk1)).toEqual(new Uint8Array(vk2));
    });
  });

  // -------------------------------------------------------
  // 9. Creator view: principal-based access (no secret needed)
  // -------------------------------------------------------

  describe('Creator view', () => {
    it('should let the creator view their own drop', async () => {
      const id = await createDrop(aliceActor, 'Creator View Drop', 5n);

      const result = await aliceActor.creator_view_drop(id, TRANSPORT_KEY);
      expect('ok' in result).toBe(true);
      if ('ok' in result) {
        expect(new Uint8Array(result.ok.creator_encrypted_data)).toEqual(
          SAMPLE_CREATOR_ENCRYPTED_DATA,
        );
        expect(result.ok.detail.title).toBe('Creator View Drop');
      }
    });

    it('should reject non-creators from viewing', async () => {
      const id = await createDrop(aliceActor, 'Alice Private Drop', 5n);

      const result = await bobActor.creator_view_drop(id, TRANSPORT_KEY);
      expect('err' in result).toBe(true);
      if ('err' in result) {
        expect(result.err).toBe('Not the creator');
      }
    });

    it('should return a different key than the claimant key', async () => {
      const id = await createDrop(aliceActor, 'Dual Key Drop', 10n);

      const creatorResult = await aliceActor.creator_view_drop(id, TRANSPORT_KEY);
      const claimResult = await bobActor.claim_drop(id, CORRECT_SECRET_HASH, TRANSPORT_KEY);

      expect('ok' in creatorResult).toBe(true);
      expect('ok' in claimResult).toBe(true);

      if ('ok' in creatorResult && 'ok' in claimResult) {
        // Creator key and claimant key MUST be different —
        // they use different derivation inputs
        const creatorKey = new Uint8Array(creatorResult.ok.encrypted_key);
        const claimantKey = new Uint8Array(claimResult.ok.encrypted_key);
        expect(creatorKey).not.toEqual(claimantKey);
      }
    });

    it('should not count as a claim', async () => {
      const id = await createDrop(aliceActor, 'No Count Drop', 1n);

      // Creator views multiple times
      await aliceActor.creator_view_drop(id, TRANSPORT_KEY);
      await aliceActor.creator_view_drop(id, TRANSPORT_KEY);

      const info = await aliceActor.get_drop_info(id);
      expect(info[0]!.claims).toBe(0n);

      // The single allowed claim should still work
      const result = await bobActor.claim_drop(id, CORRECT_SECRET_HASH, TRANSPORT_KEY);
      expect('ok' in result).toBe(true);
    });
  });

  // -------------------------------------------------------
  // 10. Claim log
  // -------------------------------------------------------

  describe('Claim log', () => {
    it('should record claimant principal and timestamp', async () => {
      const id = await createDrop(aliceActor, 'Logged Drop', 5n);

      await bobActor.claim_drop(id, CORRECT_SECRET_HASH, TRANSPORT_KEY);
      await eveActor.claim_drop(id, CORRECT_SECRET_HASH, TRANSPORT_KEY);

      // Creator views to get the claim log
      const result = await aliceActor.creator_view_drop(id, TRANSPORT_KEY);
      expect('ok' in result).toBe(true);
      if ('ok' in result) {
        const log = result.ok.detail.claim_log;
        expect(log).toHaveLength(2);
        expect(log[0].claimant.toText()).toBe(BOB_PRINCIPAL.toText());
        expect(log[1].claimant.toText()).toBe(EVE_PRINCIPAL.toText());
        expect(log[0].claimed_at).toBeGreaterThan(0n);
      }
    });

    it('should not expose claim log via get_drop_info', async () => {
      const id = await createDrop(aliceActor, 'Hidden Log Drop', 5n);
      await bobActor.claim_drop(id, CORRECT_SECRET_HASH, TRANSPORT_KEY);

      const info = await aliceActor.get_drop_info(id);
      expect((info[0] as any).claim_log).toBeUndefined();
    });

    it('should show claim log in list_my_drops for the creator', async () => {
      const id = await createDrop(aliceActor, 'Listed Log Drop', 5n);
      await bobActor.claim_drop(id, CORRECT_SECRET_HASH, TRANSPORT_KEY);

      const drops = await aliceActor.list_my_drops();
      const drop = drops.find((d) => d.id === id);
      expect(drop).toBeDefined();
      expect(drop!.claim_log).toHaveLength(1);
      expect(drop!.claim_log[0].claimant.toText()).toBe(BOB_PRINCIPAL.toText());
    });
  });
});
