# Friction Point Log

**Your Full Name:** Jorgen Hookham

---

## Step 1: Motoko compilation — `transient` and `persistent` keywords required

**Day:** 1
**Agent:** Claude Code
**Model/Version:** Opus 4.6 (1M context)
**Timestamp:** 12:32

**What you asked/did:**
Asked the agent to build a Motoko backend canister with vetKeys for an encrypted data lake product.

**What the agent did:**
Generated Motoko code using `actor class` and `let`/`var` declarations without `transient`/`persistent` keywords. The build failed with errors:
- `type error [M0219], this declaration is currently implicitly transient, please declare it explicitly 'transient'`
- `type error [M0220], this actor or actor class should be declared 'persistent'`

The agent fixed these in two rounds of compilation.

**Outcome:**
⚠️ Worked but with friction (explain below)

**Friction details (if any):**
The agent generated older-style Motoko syntax that doesn't compile with the Motoko version bundled with dfx 0.30.1. Required two fix iterations. The `persistent actor class` and `transient let/var` syntax is relatively new and the agent's training data predates it.

**Severity:**
🟢 Minor annoyance (cosmetic, slow, awkward)

**Root cause (your best guess):**
Agent hallucinated / ignored the skill
*(Agent used outdated Motoko syntax from training data. No skill was loaded — this was baseline agent knowledge.)*

**Time spent on this step:** 3 minutes
**Would a junior developer have gotten past this alone?** Probably
*(The compiler errors are clear and self-explanatory.)*

---

## Step 2: PocketIC vetKeys — "existing enabled keys: []"

**Day:** 1
**Agent:** Claude Code
**Model/Version:** Opus 4.6 (1M context)
**Timestamp:** 12:37

**What you asked/did:**
Running the PICjs test suite against the backend canister that calls `vetkd_derive_key`.

**What the agent did:**
Created a PocketIC instance with default options (no subnet config). All vetKey-dependent tests failed with:
`ChainKeyError("Requested unknown or disabled threshold key: vetkd:Bls12_381_G2:dfx_test_key, existing enabled keys: []")`

The agent had to research how to enable vetKD keys in PocketIC, discovering that an II or Fiduciary subnet must be configured to provision the test keys.

**Fix:** Added `ii: { state: { type: SubnetStateType.New } }` to `PocketIc.create()` options.

**Outcome:**
⚠️ Worked but with friction (explain below)

**Friction details (if any):**
The `@dfinity/pic` TypeScript types don't surface any documentation about which subnet types provision which chain keys. The agent's sub-agent research took ~4 minutes to find the answer. The PocketIC docs (Rust-focused HOWTO) mention this, but the PicJS docs don't.

**Severity:**
🟡 Moderate friction (workaround needed, wasted time)

**Root cause (your best guess):**
Documentation gap (skill is fine, but linked docs are wrong)
*(PicJS docs don't explain vetKD subnet requirements. Had to cross-reference Rust PocketIC docs.)*

**Time spent on this step:** 5 minutes
**Would a junior developer have gotten past this alone?** Unlikely

---

## Step 3: PocketIC vetKeys — "transport public key is invalid"

**Day:** 1
**Agent:** Claude Code
**Model/Version:** Opus 4.6 (1M context)
**Timestamp:** 12:42

**What you asked/did:**
Running tests after fixing the subnet config. Tests that call `claim_drop` (which calls `vetkd_derive_key`) failed.

**What the agent did:**
Used a fake transport public key (`new Uint8Array(48).fill(0x01)`) which is not a valid BLS12-381 G2 point. The management canister rejected it with "The provided transport public key is invalid."

**Fix:** Used `TransportSecretKey.random().publicKeyBytes()` from `@dfinity/vetkeys` to generate a valid transport key.

**Outcome:**
⚠️ Worked but with friction (explain below)

**Friction details (if any):**
The agent initially didn't realize the transport key must be a valid elliptic curve point, not arbitrary bytes. One iteration to fix.

**Severity:**
🟢 Minor annoyance (cosmetic, slow, awkward)

**Root cause (your best guess):**
Agent hallucinated / ignored the skill
*(Agent didn't know the transport key format requirement.)*

**Time spent on this step:** 2 minutes
**Would a junior developer have gotten past this alone?** Probably
*(Error message is clear, and `@dfinity/vetkeys` exports `TransportSecretKey` prominently.)*

---

## Step 4: PocketIC expiry test — time mismatch with Date.now()

**Day:** 1
**Agent:** Claude Code
**Model/Version:** Opus 4.6 (1M context)
**Timestamp:** 12:43

**What you asked/did:**
Expiry test failed — created a drop with expiry in the "past" using `Date.now()`, but PocketIC's internal clock is different.

**What the agent did:**
Used `BigInt(Date.now()) * 1_000_000n` to set an expiry timestamp, but PocketIC's `Time.now()` runs on its own simulated clock, not wall clock time. The drop wasn't actually expired from the canister's perspective.

**Fix:** Probed the canister's `created_at` timestamp to learn PocketIC's current time, set expiry relative to that, then used `pic.advanceTime()` to move past it.

**Outcome:**
⚠️ Worked but with friction (explain below)

**Friction details (if any):**
Minor — one test iteration to fix. PocketIC's time model is documented but easy to forget.

**Severity:**
🟢 Minor annoyance (cosmetic, slow, awkward)

**Root cause (your best guess):**
Agent hallucinated / ignored the skill

**Time spent on this step:** 2 minutes
**Would a junior developer have gotten past this alone?** Probably

---

## Step 5: Internet Identity — canister not found (404)

**Day:** 1
**Agent:** Claude Code
**Model/Version:** Opus 4.6 (1M context)
**Timestamp:** ~12:50

**What you asked/did:**
Tried to sign in via Internet Identity on the locally deployed frontend.

**What the agent did:**
The frontend was configured to point to `rdmx6-jaaaa-aaaaa-aaadq-cai` for II, but the II canister was never deployed locally. The agent hadn't included II in the initial `dfx.json`.

**Fix:** Added `internet_identity` as a `type: "pull"` dependency and deployed it.

**Outcome:**
⚠️ Worked but with friction (explain below)

**Friction details (if any):**
The agent should have included II in the initial project scaffold since the app requires authentication. This was a planning oversight.

**Severity:**
🟢 Minor annoyance (cosmetic, slow, awkward)

**Root cause (your best guess):**
Skill is missing coverage for this case
*(No skill was loaded. The agent didn't proactively set up II as part of the initial scaffold.)*

**Time spent on this step:** 3 minutes
**Would a junior developer have gotten past this alone?** Probably

---

## Step 6: Internet Identity — Response Verification Error (503) — BLOCKER

**Day:** 1
**Agent:** Claude Code
**Model/Version:** Opus 4.6 (1M context)
**Timestamp:** 12:55 – 13:10

**What you asked/did:**
After deploying II with `type: "pull"`, navigating to the II canister URL showed "Error 503 - Response Verification Error."

**What the agent did:**
Multiple failed attempts over ~15 minutes:
1. Tried switching to legacy URL format (`127.0.0.1:4943/?canisterId=...`) — still 503
2. Tried restarting dfx with `--domain localhost` — still 503
3. Switched from `type: "pull"` to `type: "custom"` with the dev WASM (`internet_identity_dev.wasm.gz`) — still 503
4. Tried using the Vite dev server instead of the asset canister — II popup still 503
5. User told the agent to search the docs properly
6. Agent discovered that `internet_identity_dev.wasm.gz` is **backend-only** (returns "Asset / not found.")
7. Agent discovered that II now has a **separate frontend canister** (`internet_identity_frontend`, canister ID `uqzsh-gqaaa-aaaaq-qaada-cai`)
8. `dfx deps pull` failed because the frontend WASM lacks a `.sha256` file in the release
9. Switched to `type: "custom"` with direct download URL for both II backend and frontend
10. Frontend canister init args were wrong — tried `opt InternetIdentityInit` format but the frontend uses a different type `InternetIdentityFrontendInit`
11. Used `ic-wasm` to extract the correct init type from the WASM metadata
12. Finally deployed with correct init args: `(record { backend_canister_id = principal "..."; backend_origin = "..."; fetch_root_key = opt true; dev_csp = opt true })`
13. Got HTTP 200

**Outcome:**
🔄 Required manual intervention (explain below)

**Friction details (if any):**
This was the single biggest time sink of the session. The root causes compound:
- The `type: "pull"` approach pulled the **production** WASM which doesn't work locally (response verification fails against the local root key)
- The II project split into two canisters (backend + frontend) but the `dfx deps` tooling doesn't fully support the frontend canister yet (missing `.sha256` file in releases)
- The dev WASM is backend-only — no docs clearly state this in the context of `dfx.json` configuration
- The frontend canister has a completely different init type (`InternetIdentityFrontendInit` vs `InternetIdentityInit`) which isn't documented in the II README's local dev section
- Had to use `ic-wasm` to reverse-engineer the init type

The user had to explicitly prompt the agent to search for docs, which was the turning point.

**Severity:**
🔴 Blocker (could not proceed without external help)

**Root cause (your best guess):**
ICP tooling issue (CLI, replica, SDK)
*(Multiple compounding issues: `dfx deps pull` doesn't work for II frontend, the II release doesn't include the frontend .sha256 for pullable deps, the dev WASM split into two canisters isn't well-documented for local dev, and the frontend init type differs from the backend.)*

**Time spent on this step:** 20 minutes
**Would a junior developer have gotten past this alone?** No

---

## Step 7: Frontend error — `identity is not defined`

**Day:** 1
**Agent:** Claude Code
**Model/Version:** Opus 4.6 (1M context)
**Timestamp:** ~13:55

**What you asked/did:**
After adding the creator view feature, the app showed `ReferenceError: identity is not defined` at App.tsx:88.

**What the agent did:**
When adding `identity` as a prop to child components, the agent forgot to destructure it from the `useAuth()` hook in `App.tsx`. The line read `const { actor, isAuthenticated, loading, login, logout } = useAuth()` — missing `identity`.

**Fix:** Added `identity` to the destructure.

**Outcome:**
⚠️ Worked but with friction (explain below)

**Friction details (if any):**
Simple oversight — agent used a variable it hadn't destructured. One-line fix.

**Severity:**
🟢 Minor annoyance (cosmetic, slow, awkward)

**Root cause (your best guess):**
Other: Agent coding error — forgot to update destructure when adding new prop usage.

**Time spent on this step:** 1 minute
**Would a junior developer have gotten past this alone?** Yes

---

## Step 8: Drop disappeared after claiming — stale TanStack Query cache

**Day:** 1
**Agent:** Claude Code
**Model/Version:** Opus 4.6 (1M context)
**Timestamp:** ~14:00

**What you asked/did:**
Created a drop, shared the magic link, claimed it from another identity. Went back to the dashboard and the drop wasn't visible.

**What the agent did:**
The `MyDrops` component used TanStack Query with default settings — no `refetchInterval`, no `refetchOnWindowFocus`. After navigating away (to the claim flow) and back, the cached query result was stale and not re-fetched.

**Fix:** Added `refetchOnWindowFocus: true` and `refetchInterval: 5_000` to the query. The drop was always in the canister — confirmed via `dfx canister call get_drop_info`.

**Outcome:**
⚠️ Worked but with friction (explain below)

**Friction details (if any):**
Confusing UX — the user thought the drop was deleted. The data was fine; only the frontend cache was stale. This is a standard TanStack Query configuration issue, not ICP-specific.

**Severity:**
🟢 Minor annoyance (cosmetic, slow, awkward)

**Root cause (your best guess):**
Other: Frontend state management — TanStack Query defaults don't auto-refetch aggressively enough for this use case.

**Time spent on this step:** 3 minutes
**Would a junior developer have gotten past this alone?** Probably

---

## Step 9: Canister state wiped on `--mode reinstall`

**Day:** 1
**Agent:** Claude Code
**Model/Version:** Opus 4.6 (1M context)
**Timestamp:** ~14:05 (recurring)

**What you asked/did:**
After making backend changes (adding `creator_view_drop`, claim log, etc.), the agent redeployed with `--mode reinstall`, which wiped all test data.

**What the agent did:**
Used `dfx deploy backend --mode reinstall -y` to deploy the updated canister. Since all state was stored in `transient` variables (HashMap), reinstall wiped everything. This happened multiple times during the session.

**Outcome:**
⚠️ Worked but with friction (explain below)

**Friction details (if any):**
The agent used `transient` storage because the new Motoko compiler required explicit annotations, and `transient` was the path of least resistance for a HashMap. Proper stable storage (using stable-compatible data structures) would survive upgrades. Each reinstall meant re-creating test drops. Frustrating during iterative development.

**Severity:**
🟡 Moderate friction (workaround needed, wasted time)

**Root cause (your best guess):**
Other: Agent chose `transient` storage to satisfy compiler requirements without considering the upgrade/reinstall implications for iterative development.

**Time spent on this step:** N/A (recurring annoyance, ~5 minutes total re-creating test data)
**Would a junior developer have gotten past this alone?** Probably
*(They'd experience the same annoyance but could re-create test data.)*

---

## Step 10: Mainnet deploy — wallet canister out of cycles

**Day:** 1
**Agent:** Claude Code
**Model/Version:** Opus 4.6 (1M context)
**Timestamp:** ~14:20

**What you asked/did:**
Deploying canisters to mainnet with `dfx canister create --all --network ic`.

**What the agent did:**
The first canister (backend) was created via the wallet canister, which then ran out of cycles before creating the frontend canister. Error: `Canister 5djsk-caaaa-aaaah-qaa6a-cai is out of cycles`.

**Fix:** Created the frontend canister with `--no-wallet` flag, which uses the cycles ledger directly.

**Outcome:**
⚠️ Worked but with friction (explain below)

**Friction details (if any):**
The wallet canister had insufficient cycles but the cycles ledger had 20 TC. The agent should have used `--no-wallet` from the start since the cycles were on the ledger, not in the wallet.

**Severity:**
🟢 Minor annoyance (cosmetic, slow, awkward)

**Root cause (your best guess):**
ICP tooling issue (CLI, replica, SDK)
*(The wallet canister / cycles ledger distinction is a legacy complexity. dfx defaults to using the wallet when one exists, even when the cycles ledger has funds.)*

**Time spent on this step:** 3 minutes
**Would a junior developer have gotten past this alone?** Unlikely

---

## Step 11: Mainnet deploy — controller mismatch

**Day:** 1
**Agent:** Claude Code
**Model/Version:** Opus 4.6 (1M context)
**Timestamp:** ~14:22

**What you asked/did:**
After creating canisters, tried to install code with `dfx deploy backend --network ic`.

**What the agent did:**
Failed with "Only controllers of canister can call ic00 method install_code." The backend canister was created by the wallet (Step 10), so the wallet was the controller — not the user's principal. The frontend was created with `--no-wallet`, so the user's principal was already the controller.

**Fix:** Ran `dfx canister update-settings --network ic --wallet "$(dfx identity get-wallet --network ic)" --all --add-controller "$(dfx identity get-principal)"` to add the principal as a controller via the wallet.

**Outcome:**
⚠️ Worked but with friction (explain below)

**Friction details (if any):**
Confusing error chain — the agent first tried `update-settings` without `--wallet`, which also failed because the principal wasn't a controller. Had to use the wallet to add the principal. The error message from dfx was helpful and included the fix command.

**Severity:**
🟢 Minor annoyance (cosmetic, slow, awkward)

**Root cause (your best guess):**
ICP tooling issue (CLI, replica, SDK)
*(Wallet-created vs. directly-created canisters have different controller setups. This is a known UX friction in dfx.)*

**Time spent on this step:** 3 minutes
**Would a junior developer have gotten past this alone?** Probably
*(dfx error message includes the exact fix command.)*

---

## Step 12: Custom domain registration — smooth

**Day:** 1
**Agent:** Claude Code
**Model/Version:** Opus 4.6 (1M context)
**Timestamp:** ~14:30

**What you asked/did:**
Set up a custom domain `vaultdrop.yorn.sh` for the frontend canister.

**What the agent did:**
1. Researched the latest ICP custom domain docs via a sub-agent
2. Created `.well-known/ic-domains` file with the domain
3. Created `.ic-assets.json5` to ensure the hidden directory is served
4. Provided the three DNS records (CNAME, TXT, CNAME for ACME challenge)
5. User configured DNS
6. Agent verified records with `dig` and registered with `curl -X POST https://icp0.io/custom-domains/v1/vaultdrop.yorn.sh`

**Outcome:**
✅ Worked perfectly

**Friction details (if any):**
None — the process was smooth because the agent proactively searched for current documentation before attempting it.

**Severity:**
N/A

**Root cause (your best guess):**
N/A

**Time spent on this step:** 5 minutes
**Would a junior developer have gotten past this alone?** Probably
*(With the docs, yes. Without, the three-record setup and registration curl would be hard to discover.)*

---

## Summary

| Step | Issue | Severity | Time | Root Cause |
|------|-------|----------|------|------------|
| 1 | Motoko `transient`/`persistent` syntax | 🟢 Minor | 3 min | Outdated agent knowledge |
| 2 | PocketIC vetKD subnet config | 🟡 Moderate | 5 min | PicJS docs gap |
| 3 | Invalid transport public key | 🟢 Minor | 2 min | Agent error |
| 4 | PocketIC time mismatch | 🟢 Minor | 2 min | Agent error |
| 5 | II not deployed (404) | 🟢 Minor | 3 min | Agent planning oversight |
| 6 | **II Response Verification (503)** | **🔴 Blocker** | **20 min** | **II tooling/docs gap** |
| 7 | `identity` not destructured | 🟢 Minor | 1 min | Agent coding error |
| 8 | Stale query cache | 🟢 Minor | 3 min | Frontend config |
| 9 | State wiped on reinstall | 🟡 Moderate | 5 min | Agent architecture choice |
| 10 | Wallet out of cycles | 🟢 Minor | 3 min | dfx wallet/ledger UX |
| 11 | Controller mismatch | 🟢 Minor | 3 min | dfx wallet/ledger UX |
| 12 | Custom domain setup | ✅ None | 5 min | N/A |

**Total friction time: ~55 minutes**, of which **20 minutes** was the II blocker alone.

**Biggest takeaway:** Local Internet Identity setup is the single hardest part of ICP frontend development. The split into two canisters (backend + frontend), the lack of pullable deps support for the frontend canister, and the undocumented init type make this a blocker for any developer who doesn't already know the workaround.
