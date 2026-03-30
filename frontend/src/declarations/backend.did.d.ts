import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface ClaimRecord { 'claimed_at' : bigint, 'claimant' : Principal }
export interface ClaimResult {
  'encrypted_key' : Uint8Array | number[],
  'encrypted_data' : Uint8Array | number[],
}
export interface CreatorViewResult {
  'encrypted_key' : Uint8Array | number[],
  'detail' : DropDetail,
  'creator_encrypted_data' : Uint8Array | number[],
}
export interface DropDetail {
  'id' : DropId,
  'claims' : bigint,
  'title' : string,
  'max_claims' : bigint,
  'created_at' : bigint,
  'claim_log' : Array<ClaimRecord>,
  'expires_at' : [] | [bigint],
}
export type DropId = string;
export interface DropInfo {
  'id' : DropId,
  'claims' : bigint,
  'title' : string,
  'max_claims' : bigint,
  'created_at' : bigint,
  'expires_at' : [] | [bigint],
}
export type Result = { 'ok' : null } |
  { 'err' : string };
export type Result_1 = { 'ok' : CreatorViewResult } |
  { 'err' : string };
export type Result_2 = { 'ok' : ClaimResult } |
  { 'err' : string };
export interface VaultDrop {
  'claim_drop' : ActorMethod<
    [DropId, Uint8Array | number[], Uint8Array | number[]],
    Result_2
  >,
  'create_drop' : ActorMethod<
    [
      string,
      Uint8Array | number[],
      Uint8Array | number[],
      bigint,
      [] | [bigint],
    ],
    DropId
  >,
  'creator_view_drop' : ActorMethod<[DropId, Uint8Array | number[]], Result_1>,
  'get_drop_info' : ActorMethod<[DropId], [] | [DropInfo]>,
  'get_verification_key' : ActorMethod<[], Uint8Array | number[]>,
  'list_my_drops' : ActorMethod<[], Array<DropDetail>>,
  'set_drop_data' : ActorMethod<
    [DropId, Uint8Array | number[], Uint8Array | number[]],
    Result
  >,
}
export interface _SERVICE extends VaultDrop {}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
