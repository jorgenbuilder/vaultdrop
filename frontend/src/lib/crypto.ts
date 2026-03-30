import {
  TransportSecretKey,
  DerivedPublicKey,
  EncryptedVetKey,
  IbeCiphertext,
  IbeIdentity,
  IbeSeed,
} from '@dfinity/vetkeys';

/**
 * Generate a random drop secret and its SHA-256 hash.
 * The secret goes in the magic link; the hash is the vetKey derivation input.
 */
export async function generateDropSecret(): Promise<{
  secret: Uint8Array;
  hash: Uint8Array;
}> {
  const secret = crypto.getRandomValues(new Uint8Array(32));
  const hashBuffer = await crypto.subtle.digest('SHA-256', secret);
  return { secret, hash: new Uint8Array(hashBuffer) };
}

/**
 * Encode a drop secret as a URL-safe base64 string for the magic link.
 */
export function secretToBase64(secret: Uint8Array): string {
  return btoa(String.fromCharCode(...secret))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Decode a URL-safe base64 string back to a drop secret.
 */
export function base64ToSecret(b64: string): Uint8Array {
  const padded = b64.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/**
 * Hash a drop secret to get the derivation hash.
 */
export async function hashSecret(secret: Uint8Array): Promise<Uint8Array> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', secret);
  return new Uint8Array(hashBuffer);
}

/**
 * Build the derivation input that matches the canister's logic:
 * concat(encodeUtf8(dropId), suffix)
 */
function buildDerivationInput(
  dropId: string,
  suffix: Uint8Array,
): Uint8Array {
  const idBytes = new TextEncoder().encode(dropId);
  const result = new Uint8Array(idBytes.length + suffix.length);
  result.set(idBytes);
  result.set(suffix, idBytes.length);
  return result;
}

/**
 * Encrypt data for a drop using IBE.
 * The data is encrypted to the identity (dropId + H(secret)).
 */
export function encryptForDrop(
  verificationKey: Uint8Array,
  dropId: string,
  derivationHash: Uint8Array,
  plaintext: Uint8Array,
): Uint8Array {
  const dpk = DerivedPublicKey.deserialize(verificationKey);
  const input = buildDerivationInput(dropId, derivationHash);
  const identity = IbeIdentity.fromBytes(input);
  const ciphertext = IbeCiphertext.encrypt(
    dpk,
    identity,
    plaintext,
    IbeSeed.random(),
  );
  return ciphertext.serialize();
}

/**
 * Decrypt data from a claimed drop.
 * Takes the encrypted vetKey from the canister and decrypts it,
 * then uses the resulting vetKey to decrypt the IBE ciphertext.
 */
export function decryptDrop(
  encryptedKey: Uint8Array,
  verificationKey: Uint8Array,
  tsk: TransportSecretKey,
  dropId: string,
  derivationHash: Uint8Array,
  encryptedData: Uint8Array,
): Uint8Array {
  const dpk = DerivedPublicKey.deserialize(verificationKey);
  const input = buildDerivationInput(dropId, derivationHash);
  const encVetKey = EncryptedVetKey.deserialize(encryptedKey);
  const vetKey = encVetKey.decryptAndVerify(tsk, dpk, input);
  const ciphertext = IbeCiphertext.deserialize(encryptedData);
  return ciphertext.decrypt(vetKey);
}

/**
 * Encrypt data for the creator using IBE with (dropId, creatorPrincipalBytes).
 * This lets the creator decrypt without knowing the magic link secret.
 */
export function encryptForCreator(
  verificationKey: Uint8Array,
  dropId: string,
  creatorPrincipalBytes: Uint8Array,
  plaintext: Uint8Array,
): Uint8Array {
  const dpk = DerivedPublicKey.deserialize(verificationKey);
  const input = buildDerivationInput(dropId, creatorPrincipalBytes);
  const identity = IbeIdentity.fromBytes(input);
  const ciphertext = IbeCiphertext.encrypt(
    dpk,
    identity,
    plaintext,
    IbeSeed.random(),
  );
  return ciphertext.serialize();
}

/**
 * Decrypt data from creator_view_drop.
 * Uses the creator's principal-based derivation path.
 */
export function decryptCreatorDrop(
  encryptedKey: Uint8Array,
  verificationKey: Uint8Array,
  tsk: TransportSecretKey,
  dropId: string,
  creatorPrincipalBytes: Uint8Array,
  creatorEncryptedData: Uint8Array,
): Uint8Array {
  const dpk = DerivedPublicKey.deserialize(verificationKey);
  const input = buildDerivationInput(dropId, creatorPrincipalBytes);
  const encVetKey = EncryptedVetKey.deserialize(encryptedKey);
  const vetKey = encVetKey.decryptAndVerify(tsk, dpk, input);
  const ciphertext = IbeCiphertext.deserialize(creatorEncryptedData);
  return ciphertext.decrypt(vetKey);
}

/**
 * Create a transport secret key for the claim flow.
 */
export function createTransportKey(): {
  tsk: TransportSecretKey;
  publicKeyBytes: Uint8Array;
} {
  const tsk = TransportSecretKey.random();
  return { tsk, publicKeyBytes: tsk.publicKeyBytes() };
}
