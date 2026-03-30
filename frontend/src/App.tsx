import { useAuth } from './hooks/useAuth';
import { CreateDrop } from './components/CreateDrop';
import { ClaimDrop } from './components/ClaimDrop';
import { MyDrops } from './components/MyDrops';
import { Landing } from './components/Landing';

function parseClaimRoute(): { dropId: string; secret: string } | null {
  const path = window.location.pathname;
  const match = path.match(/^\/d\/(.+)$/);
  if (!match) return null;
  const hash = window.location.hash.slice(1);
  if (!hash) return null;
  return { dropId: match[1], secret: hash };
}

export function App() {
  const { identity, actor, isAuthenticated, loading, login, logout } =
    useAuth();
  const claimRoute = parseClaimRoute();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Claim flow — anyone with the link
  if (claimRoute && actor) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-xl mx-auto px-4 py-12">
          <h1 className="text-2xl font-bold mb-2">VaultDrop</h1>
          <p className="text-muted-foreground mb-6">
            Someone sent you an encrypted drop.
          </p>
          {!isAuthenticated ? (
            <div className="rounded-lg border border-border bg-card p-6 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                Sign in to decrypt this drop.
              </p>
              <button
                onClick={login}
                className="rounded-md bg-primary px-6 py-2 text-sm text-primary-foreground hover:opacity-90"
              >
                Sign in with Internet Identity
              </button>
            </div>
          ) : (
            <ClaimDrop
              actor={actor}
              dropId={claimRoute.dropId}
              secretB64={claimRoute.secret}
            />
          )}
        </div>
      </div>
    );
  }

  // Landing page for unauthenticated users
  if (!isAuthenticated) {
    return <Landing onSignIn={login} />;
  }

  // Dashboard for authenticated users
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-xl mx-auto px-4 py-12 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">VaultDrop</h1>
            <p className="text-sm text-muted-foreground">
              Encrypted document sharing for professionals
            </p>
          </div>
          <button
            onClick={logout}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
          >
            Sign out
          </button>
        </div>

        {actor && identity && (
          <>
            <CreateDrop actor={actor} identity={identity} />
            <MyDrops actor={actor} identity={identity} />
          </>
        )}
      </div>
    </div>
  );
}
