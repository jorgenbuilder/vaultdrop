import Principal "mo:base/Principal";
import Text "mo:base/Text";
import Blob "mo:base/Blob";
import HashMap "mo:base/HashMap";
import Nat "mo:base/Nat";
import Time "mo:base/Time";
import Result "mo:base/Result";
import Array "mo:base/Array";
import Buffer "mo:base/Buffer";
import ExperimentalCycles "mo:base/ExperimentalCycles";

persistent actor class VaultDrop(keyName : Text) {

    // -- Types --

    type DropId = Text;

    type ClaimRecord = {
        claimant : Principal;
        claimed_at : Int;
    };

    type Drop = {
        creator : Principal;
        title : Text;
        encrypted_data : Blob;         // IBE encrypted to (dropId, H(secret)) — for claimants
        creator_encrypted_data : Blob;  // IBE encrypted to (dropId, creator_principal) — for creator
        max_claims : Nat;
        claims : Nat;
        claim_log : [ClaimRecord];
        created_at : Int;
        expires_at : ?Int;
    };

    type DropInfo = {
        id : DropId;
        title : Text;
        max_claims : Nat;
        claims : Nat;
        created_at : Int;
        expires_at : ?Int;
    };

    type DropDetail = {
        id : DropId;
        title : Text;
        max_claims : Nat;
        claims : Nat;
        claim_log : [ClaimRecord];
        created_at : Int;
        expires_at : ?Int;
    };

    type ClaimResult = {
        encrypted_key : Blob;
        encrypted_data : Blob;
    };

    type CreatorViewResult = {
        encrypted_key : Blob;
        creator_encrypted_data : Blob;
        detail : DropDetail;
    };

    // Management canister vetKD interface
    type VetKdApi = actor {
        vetkd_public_key : ({
            canister_id : ?Principal;
            context : Blob;
            key_id : { curve : { #bls12_381_g2 }; name : Text };
        }) -> async ({ public_key : Blob });
        vetkd_derive_key : ({
            input : Blob;
            context : Blob;
            key_id : { curve : { #bls12_381_g2 }; name : Text };
            transport_public_key : Blob;
        }) -> async ({ encrypted_key : Blob });
    };

    // -- State --

    transient let mc : VetKdApi = actor ("aaaaa-aa");
    transient var nextId : Nat = 0;
    transient let drops = HashMap.HashMap<DropId, Drop>(16, Text.equal, Text.hash);

    // -- Helpers --

    func vetKeyId() : { curve : { #bls12_381_g2 }; name : Text } {
        { curve = #bls12_381_g2; name = keyName };
    };

    transient let CONTEXT : Blob = Text.encodeUtf8("vaultdrop");

    func buildDerivationInput(dropId : DropId, suffix : Blob) : Blob {
        Blob.fromArray(
            Array.append(
                Blob.toArray(Text.encodeUtf8(dropId)),
                Blob.toArray(suffix),
            )
        );
    };

    func toDetail(id : DropId, d : Drop) : DropDetail {
        {
            id;
            title = d.title;
            max_claims = d.max_claims;
            claims = d.claims;
            claim_log = d.claim_log;
            created_at = d.created_at;
            expires_at = d.expires_at;
        };
    };

    // -- Public API --

    /// Returns the vetKey verification (public) key for this canister's domain.
    public shared func get_verification_key() : async Blob {
        let { public_key } = await mc.vetkd_public_key({
            canister_id = null;
            context = CONTEXT;
            key_id = vetKeyId();
        });
        public_key;
    };

    /// Create a new encrypted drop. Caller must be authenticated.
    public shared ({ caller }) func create_drop(
        title : Text,
        encrypted_data : Blob,
        creator_encrypted_data : Blob,
        max_claims : Nat,
        expires_at : ?Int,
    ) : async DropId {
        assert (not Principal.isAnonymous(caller));
        assert (max_claims > 0);

        let id = Nat.toText(nextId);
        nextId += 1;
        drops.put(id, {
            creator = caller;
            title;
            encrypted_data;
            creator_encrypted_data;
            max_claims;
            claims = 0;
            claim_log = [];
            created_at = Time.now();
            expires_at;
        });
        id;
    };

    /// Update the encrypted data for a drop. Only the creator can call this,
    /// and only before any claims have been made.
    public shared ({ caller }) func set_drop_data(
        drop_id : DropId,
        encrypted_data : Blob,
        creator_encrypted_data : Blob,
    ) : async Result.Result<(), Text> {
        switch (drops.get(drop_id)) {
            case null { #err("Drop not found") };
            case (?d) {
                if (not Principal.equal(d.creator, caller)) {
                    return #err("Not the creator");
                };
                if (d.claims > 0) {
                    return #err("Drop already has claims");
                };
                drops.put(drop_id, { d with encrypted_data; creator_encrypted_data });
                #ok(());
            };
        };
    };

    /// Get public metadata for a drop (no secrets).
    public query func get_drop_info(drop_id : DropId) : async ?DropInfo {
        switch (drops.get(drop_id)) {
            case null { null };
            case (?d) {
                ?{
                    id = drop_id;
                    title = d.title;
                    max_claims = d.max_claims;
                    claims = d.claims;
                    created_at = d.created_at;
                    expires_at = d.expires_at;
                };
            };
        };
    };

    /// Creator views their own drop: derives vetKey using (dropId, creator_principal).
    /// Does NOT count as a claim.
    public shared ({ caller }) func creator_view_drop(
        drop_id : DropId,
        transport_public_key : Blob,
    ) : async Result.Result<CreatorViewResult, Text> {
        switch (drops.get(drop_id)) {
            case null { #err("Drop not found") };
            case (?d) {
                if (not Principal.equal(d.creator, caller)) {
                    return #err("Not the creator");
                };

                // Derivation input uses the creator's principal — no secret needed
                let input = buildDerivationInput(drop_id, Principal.toBlob(caller));

                ExperimentalCycles.add<system>(26_153_846_153);
                let { encrypted_key } = await mc.vetkd_derive_key({
                    input;
                    context = CONTEXT;
                    key_id = vetKeyId();
                    transport_public_key;
                });

                #ok({
                    encrypted_key;
                    creator_encrypted_data = d.creator_encrypted_data;
                    detail = toDetail(drop_id, d);
                });
            };
        };
    };

    /// Claim a drop: provide the derivation hash (from the magic link secret)
    /// and a transport public key. Returns the encrypted vetKey + encrypted data.
    /// The canister does NOT verify the derivation hash — wrong hash = wrong key = can't decrypt.
    /// Rate limiting (max_claims, expiry) is enforced here.
    public shared ({ caller }) func claim_drop(
        drop_id : DropId,
        derivation_hash : Blob,
        transport_public_key : Blob,
    ) : async Result.Result<ClaimResult, Text> {
        switch (drops.get(drop_id)) {
            case null { #err("Drop not found") };
            case (?d) {
                if (d.claims >= d.max_claims) {
                    return #err("Max claims reached");
                };
                switch (d.expires_at) {
                    case (?exp) {
                        if (Time.now() > exp) {
                            return #err("Drop expired");
                        };
                    };
                    case null {};
                };

                let input = buildDerivationInput(drop_id, derivation_hash);

                ExperimentalCycles.add<system>(26_153_846_153);
                let { encrypted_key } = await mc.vetkd_derive_key({
                    input;
                    context = CONTEXT;
                    key_id = vetKeyId();
                    transport_public_key;
                });

                // Record claim and increment count
                let record : ClaimRecord = {
                    claimant = caller;
                    claimed_at = Time.now();
                };
                drops.put(drop_id, {
                    d with
                    claims = d.claims + 1;
                    claim_log = Array.append(d.claim_log, [record]);
                });

                #ok({
                    encrypted_key;
                    encrypted_data = d.encrypted_data;
                });
            };
        };
    };

    /// List drops created by the caller, including claim log.
    public shared query ({ caller }) func list_my_drops() : async [DropDetail] {
        let buf = Buffer.Buffer<DropDetail>(8);
        for ((id, d) in drops.entries()) {
            if (Principal.equal(d.creator, caller)) {
                buf.add(toDetail(id, d));
            };
        };
        Buffer.toArray(buf);
    };
};
