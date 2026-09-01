export type RuntimeJsonValue =
  null | boolean | number | string | RuntimeJsonObject | RuntimeJsonValue[];

export interface RuntimeJsonObject {
  readonly [key: string]: RuntimeJsonValue;
}

const RUNTIME_TYPE = '__finwiseRuntimeType';

interface TaggedRuntimeValue extends RuntimeJsonObject {
  readonly [RUNTIME_TYPE]: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUnknownMap(value: unknown): value is Map<unknown, unknown> {
  return value instanceof Map;
}

function tagged(type: string, value: RuntimeJsonValue): RuntimeJsonObject {
  return { [RUNTIME_TYPE]: type, value };
}

function encodeValue(value: unknown): RuntimeJsonValue | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('Runtime store state contains a non-finite number.');
    }
    return value;
  }
  if (typeof value === 'bigint') {
    return tagged('bigint', value.toString());
  }
  if (value instanceof Date) {
    return tagged('date', value.toISOString());
  }
  if (value instanceof Map) {
    const entries: RuntimeJsonValue[] = [];
    for (const [key, entryValue] of value.entries()) {
      const encodedKey = encodeValue(key);
      const encodedValue = encodeValue(entryValue);
      if (encodedKey === undefined || encodedValue === undefined) {
        throw new Error('Runtime store maps cannot contain undefined values.');
      }
      entries.push([encodedKey, encodedValue]);
    }
    return tagged('map', entries);
  }
  if (value instanceof Set) {
    const entries: RuntimeJsonValue[] = [];
    for (const entry of value.values()) {
      const encodedEntry = encodeValue(entry);
      if (encodedEntry !== undefined) entries.push(encodedEntry);
    }
    return tagged('set', entries);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => encodeValue(entry) ?? null);
  }
  if (isRecord(value)) {
    const encoded: Record<string, RuntimeJsonValue> = {};
    for (const [key, entryValue] of Object.entries(value)) {
      const encodedEntry = encodeValue(entryValue);
      if (encodedEntry !== undefined) encoded[key] = encodedEntry;
    }
    return encoded;
  }
  throw new Error('Runtime store state contains an unsupported value.');
}

function isTaggedRuntimeValue(value: unknown): value is TaggedRuntimeValue {
  return isRecord(value) && typeof value[RUNTIME_TYPE] === 'string';
}

function decodeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((entry) => decodeValue(entry));
  if (!isRecord(value)) return value;
  if (isTaggedRuntimeValue(value)) {
    const payload = value.value;
    switch (value[RUNTIME_TYPE]) {
      case 'bigint':
        if (typeof payload !== 'string')
          throw new Error('Invalid bigint state.');
        return BigInt(payload);
      case 'date':
        if (typeof payload !== 'string') throw new Error('Invalid date state.');
        return new Date(payload);
      case 'map': {
        if (!Array.isArray(payload)) throw new Error('Invalid map state.');
        const map = new Map<unknown, unknown>();
        for (const entry of payload) {
          if (!Array.isArray(entry) || entry.length !== 2) {
            throw new Error('Invalid map entry state.');
          }
          map.set(decodeValue(entry[0]), decodeValue(entry[1]));
        }
        return map;
      }
      case 'set':
        if (!Array.isArray(payload)) throw new Error('Invalid set state.');
        return new Set(payload.map((entry) => decodeValue(entry)));
      default:
        throw new Error('Unknown runtime store state marker.');
    }
  }
  const object: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    object[key] = decodeValue(entry);
  }
  return object;
}

/**
 * Serialize only the Map-backed stores. Infrastructure dependencies held on a
 * store (for example the ledger port held by GroupStore) are intentionally
 * excluded from the snapshot.
 */
export function serializeStoreState(store: object): RuntimeJsonObject {
  const state: Record<string, RuntimeJsonValue> = {};
  for (const [property, value] of Object.entries(
    store as unknown as Record<string, unknown>,
  )) {
    if (!(value instanceof Map)) continue;
    const encoded = encodeValue(value);
    if (encoded === undefined) continue;
    state[property] = encoded;
  }
  return state;
}

/**
 * Hydrate Map-backed fields without replacing the readonly Map instances.
 * Derived indexes are rebuilt so maps that previously shared object references
 * (such as invitations and invitationsByToken) continue to do so.
 */
export function hydrateStoreState(store: object, state: unknown): void {
  const decoded = decodeValue(state);
  if (!isRecord(decoded)) return;
  const target = store as unknown as Record<string, unknown>;
  for (const [property, encodedValue] of Object.entries(decoded)) {
    const targetValue = target[property];
    const decodedValue = encodedValue;
    if (!isUnknownMap(targetValue) || !isUnknownMap(decodedValue)) continue;
    targetValue.clear();
    for (const [key, value] of decodedValue.entries()) {
      targetValue.set(key, value);
    }
  }
  rebuildDerivedIndexes(target);
}

function rebuildDerivedIndexes(target: Record<string, unknown>): void {
  const invitations = target.invitations;
  const invitationsByToken = target.invitationsByToken;
  if (isUnknownMap(invitations) && isUnknownMap(invitationsByToken)) {
    invitationsByToken.clear();
    for (const value of invitations.values()) {
      if (!isRecord(value) || typeof value.token !== 'string') continue;
      invitationsByToken.set(value.token, value);
    }
  }

  const members = target.members;
  const membersByWorkspaceUser = target.membersByWorkspaceUser;
  if (isUnknownMap(members) && isUnknownMap(membersByWorkspaceUser)) {
    membersByWorkspaceUser.clear();
    for (const value of members.values()) {
      if (
        !isRecord(value) ||
        typeof value.workspaceId !== 'string' ||
        typeof value.userId !== 'string' ||
        typeof value.id !== 'string'
      ) {
        continue;
      }
      membersByWorkspaceUser.set(
        `${value.workspaceId}:${value.userId}`,
        value.id,
      );
    }
  }

  const workspaces = target.workspaces;
  const personalWorkspaceByUser = target.personalWorkspaceByUser;
  if (
    isUnknownMap(members) &&
    isUnknownMap(workspaces) &&
    isUnknownMap(personalWorkspaceByUser)
  ) {
    personalWorkspaceByUser.clear();
    for (const member of members.values()) {
      if (!isRecord(member) || member.isOwner !== true) continue;
      const workspace = workspaces.get(member.workspaceId);
      if (
        isRecord(workspace) &&
        workspace.kind === 'personal' &&
        typeof member.userId === 'string' &&
        typeof workspace.id === 'string'
      ) {
        personalWorkspaceByUser.set(member.userId, workspace.id);
      }
    }
  }
}
