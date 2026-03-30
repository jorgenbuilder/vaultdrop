import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Identity } from '@dfinity/agent';
import type { _SERVICE } from '../declarations/backend.did.d';
import {
  generateDropSecret,
  secretToBase64,
  encryptForDrop,
  encryptForCreator,
} from '../lib/crypto';

interface Props {
  actor: _SERVICE;
  identity: Identity;
}

export function CreateDrop({ actor, identity }: Props) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [maxClaims, setMaxClaims] = useState(1);
  const [magicLink, setMagicLink] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const createDrop = useMutation({
    mutationFn: async () => {
      const { secret, hash } = await generateDropSecret();
      const vk = await actor.get_verification_key();
      const vkBytes = new Uint8Array(vk);

      // Create drop with empty data to get the ID
      const dropId = await actor.create_drop(
        title,
        new Uint8Array(0),
        new Uint8Array(0),
        BigInt(maxClaims),
        [],
      );

      const plaintext = new TextEncoder().encode(content);

      // Encrypt for claimants: IBE to (dropId, H(secret))
      const encrypted = encryptForDrop(vkBytes, dropId, hash, plaintext);

      // Encrypt for creator: IBE to (dropId, creatorPrincipal)
      const creatorPrincipalBytes = identity.getPrincipal().toUint8Array();
      const creatorEncrypted = encryptForCreator(
        vkBytes,
        dropId,
        creatorPrincipalBytes,
        plaintext,
      );

      // Update the drop with both ciphertexts
      const result = await actor.set_drop_data(
        dropId,
        encrypted,
        creatorEncrypted,
      );
      if ('err' in result) {
        throw new Error(result.err);
      }

      const b64Secret = secretToBase64(secret);
      return `${window.location.origin}/d/${dropId}#${b64Secret}`;
    },
    onSuccess: (link) => {
      setMagicLink(link);
      setTitle('');
      setContent('');
      queryClient.invalidateQueries({ queryKey: ['my-drops'] });
    },
  });

  if (magicLink) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="text-lg font-semibold mb-2">Drop Created!</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Share this magic link. Only people with this link can decrypt the
            contents.
          </p>
          <div className="flex gap-2">
            <input
              readOnly
              value={magicLink}
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
            />
            <button
              onClick={() => navigator.clipboard.writeText(magicLink)}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90"
            >
              Copy
            </button>
          </div>
        </div>
        <button
          onClick={() => setMagicLink(null)}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Create another drop
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-4">
      <h3 className="text-lg font-semibold">Create a Drop</h3>
      <div>
        <label className="block text-sm font-medium mb-1">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. API keys for staging"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">
          Secret Content
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Paste your secret text here..."
          rows={4}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Max Claims</label>
        <input
          type="number"
          min={1}
          value={maxClaims}
          onChange={(e) => setMaxClaims(Number(e.target.value))}
          className="w-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>
      <button
        onClick={() => createDrop.mutate()}
        disabled={!title || !content || createDrop.isPending}
        className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        {createDrop.isPending ? 'Encrypting...' : 'Create Drop'}
      </button>
      {createDrop.isError && (
        <p className="text-sm text-destructive">
          {(createDrop.error as Error).message}
        </p>
      )}
    </div>
  );
}
