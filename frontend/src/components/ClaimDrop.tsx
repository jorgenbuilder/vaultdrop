import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { _SERVICE } from '../declarations/backend.did.d';
import {
  base64ToSecret,
  hashSecret,
  createTransportKey,
  decryptDrop,
} from '../lib/crypto';

interface Props {
  actor: _SERVICE;
  dropId: string;
  secretB64: string;
}

export function ClaimDrop({ actor, dropId, secretB64 }: Props) {
  const [decryptedContent, setDecryptedContent] = useState<string | null>(null);

  const claim = useMutation({
    mutationFn: async () => {
      // 1. Decode secret and hash it
      const secret = base64ToSecret(secretB64);
      const derivationHash = await hashSecret(secret);

      // 2. Create transport key
      const { tsk, publicKeyBytes } = createTransportKey();

      // 3. Claim the drop
      const result = await actor.claim_drop(
        dropId,
        derivationHash,
        publicKeyBytes,
      );

      if ('err' in result) {
        throw new Error(result.err);
      }

      // 4. Get verification key
      const vk = await actor.get_verification_key();

      // 5. Decrypt
      const plaintext = decryptDrop(
        new Uint8Array(result.ok.encrypted_key),
        new Uint8Array(vk),
        tsk,
        dropId,
        derivationHash,
        new Uint8Array(result.ok.encrypted_data),
      );

      return new TextDecoder().decode(plaintext);
    },
    onSuccess: (text) => {
      setDecryptedContent(text);
    },
  });

  // Auto-claim on mount
  useEffect(() => {
    claim.mutate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (claim.isPending) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <p className="text-muted-foreground">Decrypting your drop...</p>
      </div>
    );
  }

  if (claim.isError) {
    return (
      <div className="rounded-lg border border-destructive bg-card p-6">
        <h3 className="text-lg font-semibold text-destructive mb-2">
          Failed to decrypt
        </h3>
        <p className="text-sm text-muted-foreground">
          {(claim.error as Error).message}
        </p>
      </div>
    );
  }

  if (decryptedContent) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 space-y-3">
        <h3 className="text-lg font-semibold">Drop Contents</h3>
        <pre className="rounded-md bg-muted p-4 text-sm whitespace-pre-wrap break-all">
          {decryptedContent}
        </pre>
      </div>
    );
  }

  return null;
}
