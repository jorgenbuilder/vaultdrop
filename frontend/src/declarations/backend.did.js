export const idlFactory = ({ IDL }) => {
  const DropId = IDL.Text;
  const ClaimResult = IDL.Record({
    'encrypted_key' : IDL.Vec(IDL.Nat8),
    'encrypted_data' : IDL.Vec(IDL.Nat8),
  });
  const Result_2 = IDL.Variant({ 'ok' : ClaimResult, 'err' : IDL.Text });
  const ClaimRecord = IDL.Record({
    'claimed_at' : IDL.Int,
    'claimant' : IDL.Principal,
  });
  const DropDetail = IDL.Record({
    'id' : DropId,
    'claims' : IDL.Nat,
    'title' : IDL.Text,
    'max_claims' : IDL.Nat,
    'created_at' : IDL.Int,
    'claim_log' : IDL.Vec(ClaimRecord),
    'expires_at' : IDL.Opt(IDL.Int),
  });
  const CreatorViewResult = IDL.Record({
    'encrypted_key' : IDL.Vec(IDL.Nat8),
    'detail' : DropDetail,
    'creator_encrypted_data' : IDL.Vec(IDL.Nat8),
  });
  const Result_1 = IDL.Variant({ 'ok' : CreatorViewResult, 'err' : IDL.Text });
  const DropInfo = IDL.Record({
    'id' : DropId,
    'claims' : IDL.Nat,
    'title' : IDL.Text,
    'max_claims' : IDL.Nat,
    'created_at' : IDL.Int,
    'expires_at' : IDL.Opt(IDL.Int),
  });
  const Result = IDL.Variant({ 'ok' : IDL.Null, 'err' : IDL.Text });
  const VaultDrop = IDL.Service({
    'claim_drop' : IDL.Func(
        [DropId, IDL.Vec(IDL.Nat8), IDL.Vec(IDL.Nat8)],
        [Result_2],
        [],
      ),
    'create_drop' : IDL.Func(
        [
          IDL.Text,
          IDL.Vec(IDL.Nat8),
          IDL.Vec(IDL.Nat8),
          IDL.Nat,
          IDL.Opt(IDL.Int),
        ],
        [DropId],
        [],
      ),
    'creator_view_drop' : IDL.Func([DropId, IDL.Vec(IDL.Nat8)], [Result_1], []),
    'get_drop_info' : IDL.Func([DropId], [IDL.Opt(DropInfo)], ['query']),
    'get_verification_key' : IDL.Func([], [IDL.Vec(IDL.Nat8)], []),
    'list_my_drops' : IDL.Func([], [IDL.Vec(DropDetail)], ['query']),
    'set_drop_data' : IDL.Func(
        [DropId, IDL.Vec(IDL.Nat8), IDL.Vec(IDL.Nat8)],
        [Result],
        [],
      ),
  });
  return VaultDrop;
};
export const init = ({ IDL }) => { return [IDL.Text]; };
