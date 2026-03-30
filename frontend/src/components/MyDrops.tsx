import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import type { Identity } from '@dfinity/agent';
import type { _SERVICE } from '../declarations/backend.did.d';
import { createTransportKey, decryptCreatorDrop } from '../lib/crypto';

interface Props {
  actor: _SERVICE;
  identity: Identity;
}

export function MyDrops({ actor, identity }: Props) {
  const [viewingDrop, setViewingDrop] = useState<string | null>(null);
  const [decryptedContent, setDecryptedContent] = useState<string | null>(null);

  const { data: drops, isLoading } = useQuery({
    queryKey: ['my-drops'],
    queryFn: () => actor.list_my_drops(),
    refetchOnWindowFocus: true,
    refetchInterval: 5_000,
  });

  const viewDrop = useMutation({
    mutationFn: async (dropId: string) => {
      const { tsk, publicKeyBytes } = createTransportKey();
      const result = await actor.creator_view_drop(dropId, publicKeyBytes);
      if ('err' in result) throw new Error(result.err);

      const vk = await actor.get_verification_key();
      const creatorPrincipalBytes = identity.getPrincipal().toUint8Array();

      const plaintext = decryptCreatorDrop(
        new Uint8Array(result.ok.encrypted_key),
        new Uint8Array(vk),
        tsk,
        dropId,
        creatorPrincipalBytes,
        new Uint8Array(result.ok.creator_encrypted_data),
      );

      return new TextDecoder().decode(plaintext);
    },
    onSuccess: (content, dropId) => {
      setViewingDrop(dropId);
      setDecryptedContent(content);
    },
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading drops...</p>;
  }

  if (!drops || drops.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No drops yet. Create one above.
      </p>
    );
  }

  // Viewing a specific drop's decrypted content
  if (viewingDrop && decryptedContent !== null) {
    const drop = drops.find((d) => d.id === viewingDrop);

    return (
      <div className="space-y-4">
        <button
          onClick={() => {
            setViewingDrop(null);
            setDecryptedContent(null);
          }}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Back to drops
        </button>

        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">{drop?.title}</h3>
            <span className="text-xs text-muted-foreground font-mono">
              #{viewingDrop}
            </span>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Decrypted Contents
            </label>
            <pre className="rounded-md bg-muted p-4 text-sm whitespace-pre-wrap break-all">
              {decryptedContent}
            </pre>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard view with claim logs inline
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">My Drops</h3>
      <div className="space-y-3">
        {drops.map((drop) => (
          <div
            key={drop.id}
            className="rounded-lg border border-border bg-card p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{drop.title}</p>
                <p className="text-xs text-muted-foreground">
                  {Number(drop.claims)}/{Number(drop.max_claims)} claims
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => viewDrop.mutate(drop.id)}
                  disabled={viewDrop.isPending}
                  className="rounded-md border border-border px-3 py-1 text-xs hover:bg-accent"
                >
                  {viewDrop.isPending && viewDrop.variables === drop.id
                    ? 'Decrypting...'
                    : 'View'}
                </button>
                <span className="text-xs text-muted-foreground font-mono">
                  #{drop.id}
                </span>
              </div>
            </div>

            {drop.claim_log.length > 0 && (
              <div className="border-t border-border pt-2">
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Claims
                </p>
                <div className="space-y-1">
                  {drop.claim_log.map((entry, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="font-mono truncate max-w-[240px] text-muted-foreground">
                        {entry.claimant.toText()}
                      </span>
                      <span className="text-muted-foreground ml-2 shrink-0">
                        {new Date(
                          Number(entry.claimed_at) / 1_000_000,
                        ).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {viewDrop.isError && (
        <p className="text-sm text-destructive">
          {(viewDrop.error as Error).message}
        </p>
      )}
    </div>
  );
}
