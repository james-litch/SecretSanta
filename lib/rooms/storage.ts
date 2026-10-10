import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { generateDraw } from './draw';
import { roomRedis } from './redis';
import { roomConfig, normalizeName } from './rules';
import type { PendingCreate, RoomView } from './types';

export class RoomError extends Error {
  constructor(
    public code: string,
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const unavailable = () =>
  new RoomError('unavailable', 404, 'This room doesn’t exist or has expired.');

const operationLifetime = 15 * 60 * 1000;
const roomCode = (secret: string) =>
  hash(`room:${secret}`).slice(0, 24).toUpperCase();

// A reservation and its eventual room share one key. If that key is lost, no
// create request can rebuild it. Preparing again always issues a new secret.
const prepareScript = `
if redis.call('EXISTS', KEYS[1]) == 1 then return 'collision' end
redis.call('HSET', KEYS[1], 'operationHash', ARGV[1], 'payloadHash', ARGV[2],
  'operationExpiresAt', ARGV[3])
redis.call('PEXPIREAT', KEYS[1], ARGV[3])
return 'prepared'
`;

export async function prepareCreate(name: string): Promise<PendingCreate> {
  const normalized = normalizeName(name);
  const redis = await roomRedis();
  for (let attempt = 0; attempt < 3; attempt++) {
    const secret = randomBytes(32).toString('hex');
    const result = await redis.eval(prepareScript, {
      keys: [`room:${roomCode(secret)}`],
      arguments: [
        hash(secret),
        hash(normalized.display),
        String(Date.now() + operationLifetime),
      ],
    });
    if (result === 'prepared') return { name, secret };
  }
  throw new Error('Unable to reserve a room');
}

// All preconditions precede writes. Retrying a commit is the same operation as
// the original request; only server-owned state decides whether to create.
const createScript = `
local existing = redis.call('HGET', KEYS[1], 'operationHash')
if not existing then return 'unavailable' end
if existing ~= ARGV[1] then return 'collision' end
if redis.call('HGET', KEYS[1], 'payloadHash') ~= ARGV[2] then return 'payload_mismatch' end
local operationExpiresAt = redis.call('HGET', KEYS[1], 'operationExpiresAt')
if not operationExpiresAt or tonumber(operationExpiresAt) <= tonumber(ARGV[3]) then return 'invalid_operation' end
local expiresAt = redis.call('HGET', KEYS[1], 'expiresAt')
if expiresAt then
  if tonumber(expiresAt) <= tonumber(ARGV[3]) then return 'unavailable' end
  return 'recovered'
end
redis.call('HSET', KEYS[1],
  'expiresAt', ARGV[4], 'capacity', ARGV[5], 'lifetimeDays', ARGV[6], 'ownerId', ARGV[7],
  'participants', ARGV[8], 'credentials', ARGV[9], 'names', ARGV[10],
  'state', 'waiting', 'rosterVersion', '1')
redis.call('PEXPIREAT', KEYS[1], ARGV[4])
return 'created'
`;

export async function createRoom(operation: PendingCreate) {
  const name = normalizeName(operation.name);
  if (!/^[a-f0-9]{64}$/.test(operation.secret)) {
    throw new RoomError(
      'invalid_operation',
      400,
      'The create attempt is invalid.',
    );
  }
  const now = Date.now();
  // Domain separation keeps the public code independent of the private credential.
  const code = roomCode(operation.secret);
  const credential = hash(`credential:${operation.secret}`);
  const ownerId = randomUUID();
  const config = roomConfig(process.env);
  const expiresAt = now + config.lifetimeDays * 86_400_000;
  const redis = await roomRedis();
  const result = await redis.eval(createScript, {
    keys: [`room:${code}`],
    arguments: [
      hash(operation.secret),
      hash(name.display),
      String(now),
      String(expiresAt),
      String(config.capacity),
      String(config.lifetimeDays),
      ownerId,
      JSON.stringify([{ id: ownerId, name: name.display }]),
      JSON.stringify({ [hash(credential)]: ownerId }),
      JSON.stringify({ [name.key]: ownerId }),
    ],
  });
  if (result === 'unavailable') throw unavailable();
  if (result === 'invalid_operation')
    throw new RoomError(
      'invalid_operation',
      400,
      'This create attempt has expired. Abandon this attempt to start a new room.',
    );
  if (result === 'collision' || result === 'payload_mismatch')
    throw new RoomError(
      'operation_conflict',
      409,
      'This create attempt cannot be reused with a different room or name.',
    );
  return {
    room: await readRoom(code, credential),
    credential,
    created: result === 'created',
  };
}

async function authorizedRoom(code: string, credential?: string) {
  if (!/^[A-F0-9]{24}$/.test(code)) throw unavailable();
  const redis = await roomRedis();
  const data = await redis.hGetAll(`room:${code}`);
  if (!data.expiresAt || Number(data.expiresAt) <= Date.now())
    throw unavailable();
  const credentials = JSON.parse(data.credentials) as Record<string, string>;
  const digest = hash(credential ?? '');
  const entry = Object.entries(credentials).find(([stored]) =>
    timingSafeEqual(Buffer.from(stored), Buffer.from(digest)),
  );
  if (!entry)
    throw new RoomError(
      'invalid_identity',
      401,
      'Your saved access is missing or invalid. Your name and room code cannot recover it.',
    );
  return { data, currentParticipantId: entry[1] };
}

export async function readRoom(
  code: string,
  credential?: string,
): Promise<RoomView> {
  const { data, currentParticipantId } = await authorizedRoom(code, credential);
  const participants: RoomView['participants'] = JSON.parse(data.participants);
  const recipientId =
    data.state === 'drawn'
      ? JSON.parse(data.assignments)[currentParticipantId]
      : undefined;
  return {
    code,
    state: data.state as RoomView['state'],
    ...(recipientId
      ? { recipient: participants.find((p) => p.id === recipientId)! }
      : {}),
    expiresAt: Number(data.expiresAt),
    capacity: Number(data.capacity),
    lifetimeDays: Number(data.lifetimeDays),
    ownerId: data.ownerId,
    currentParticipantId,
    isOwner: data.ownerId === currentParticipantId,
    participants,
  };
}

// Existing identity and successful retries win before new-membership checks.
// All writes are last; HSET preserves the room's original Redis deadline.
const joinScript = `
local expiresAt = redis.call('HGET', KEYS[1], 'expiresAt')
if not expiresAt or tonumber(expiresAt) <= tonumber(ARGV[1]) then return 'unavailable' end
local credentials = cjson.decode(redis.call('HGET', KEYS[1], 'credentials'))
if credentials[ARGV[2]] then return 'existing' end
local retry = redis.call('HGET', KEYS[1], 'join:' .. ARGV[3])
if retry then
  retry = cjson.decode(retry)
  if retry.payload ~= ARGV[4] then return 'operation_conflict' end
  if retry.expiresAt <= tonumber(ARGV[1]) then return 'invalid_operation' end
  return 'recovered'
end
if redis.call('HGET', KEYS[1], 'state') ~= 'waiting' then return 'joining_closed' end
local participants = cjson.decode(redis.call('HGET', KEYS[1], 'participants'))
if #participants >= tonumber(redis.call('HGET', KEYS[1], 'capacity')) then return 'room_full' end
local names = cjson.decode(redis.call('HGET', KEYS[1], 'names'))
if names[ARGV[5]] then return 'duplicate_name' end
local version = tonumber(redis.call('HGET', KEYS[1], 'rosterVersion'))
table.insert(participants, {id=ARGV[6], name=ARGV[7]})
credentials[ARGV[8]] = ARGV[6]
names[ARGV[5]] = ARGV[6]
redis.call('HSET', KEYS[1], 'participants', cjson.encode(participants),
  'credentials', cjson.encode(credentials), 'names', cjson.encode(names),
  'rosterVersion', tostring(version + 1), 'join:' .. ARGV[3],
  cjson.encode({payload=ARGV[4], expiresAt=tonumber(ARGV[9])}))
return 'joined'
`;

export async function joinRoom(
  code: string,
  operation: PendingCreate,
  savedCredential?: string,
) {
  const name = normalizeName(operation.name);
  if (!/^[A-F0-9]{24}$/.test(code))
    throw new RoomError(
      'invalid_code',
      400,
      'Enter the complete room code shared with you.',
    );
  if (!/^[a-f0-9]{64}$/.test(operation.secret))
    throw new RoomError(
      'invalid_operation',
      400,
      'This join attempt is invalid.',
    );
  const now = Date.now();
  const credential = hash(`join-credential:${code}:${operation.secret}`);
  const redis = await roomRedis();
  const result = await redis.eval(joinScript, {
    keys: [`room:${code}`],
    arguments: [
      String(now),
      hash(savedCredential ?? ''),
      hash(operation.secret),
      hash(name.display),
      name.key,
      randomUUID(),
      name.display,
      hash(credential),
      String(now + operationLifetime),
    ],
  });
  if (result === 'unavailable') throw unavailable();
  const failures: Record<string, string> = {
    joining_closed:
      'This room has already drawn. Open it in the browser you used to join.',
    room_full:
      'This room is full. Ask your group to start a new room if someone is missing.',
    duplicate_name:
      'Someone in this room already uses that name. Choose a distinguishable name.',
    operation_conflict:
      'This join attempt cannot be reused with a different name.',
    invalid_operation:
      'This join attempt has expired. Your name and room code cannot recover access.',
  };
  if (typeof result === 'string' && failures[result])
    throw new RoomError(result, 409, failures[result]);
  const access = result === 'existing' ? savedCredential! : credential;
  return {
    room: await readRoom(code, access),
    credential: access,
    joined: result === 'joined',
  };
}

// Ownership, original expiry, state and roster are checked together before the
// only write. A concurrent saved draw wins even if this proposal became stale.
const drawScript = `
local expiresAt = redis.call('HGET', KEYS[1], 'expiresAt')
local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
if not expiresAt or tonumber(expiresAt) <= now then return 'unavailable' end
local credentials = cjson.decode(redis.call('HGET', KEYS[1], 'credentials'))
local participant = credentials[ARGV[1]]
if not participant then return 'invalid_identity' end
if participant ~= redis.call('HGET', KEYS[1], 'ownerId') then return 'owner_only' end
if redis.call('HGET', KEYS[1], 'state') == 'drawn' then return 'saved' end
if expiresAt ~= ARGV[2] then return 'unavailable' end
if redis.call('HGET', KEYS[1], 'rosterVersion') ~= ARGV[3] then return 'roster_changed' end
local participants = cjson.decode(redis.call('HGET', KEYS[1], 'participants'))
if #participants < 3 then return 'insufficient_membership' end
redis.call('HSET', KEYS[1], 'state', 'drawn', 'assignments', ARGV[4])
return 'saved'
`;

export async function drawRoom(
  code: string,
  credential?: string,
): Promise<RoomView> {
  const redis = await roomRedis();
  for (let attempt = 0; attempt < 8; attempt++) {
    const { data, currentParticipantId } = await authorizedRoom(
      code,
      credential,
    );
    if (data.ownerId !== currentParticipantId)
      throw new RoomError(
        'owner_only',
        403,
        'Only the room owner can draw names.',
      );
    if (data.state === 'drawn') return readRoom(code, credential);
    const participants: RoomView['participants'] = JSON.parse(
      data.participants,
    );
    if (participants.length < 3)
      throw new RoomError(
        'insufficient_membership',
        409,
        'A draw needs at least three participants.',
      );
    const assignments = generateDraw(participants.map((p) => p.id));
    const result = await redis.eval(drawScript, {
      keys: [`room:${code}`],
      arguments: [
        hash(credential ?? ''),
        data.expiresAt,
        data.rosterVersion,
        JSON.stringify(assignments),
      ],
    });
    if (result === 'saved') return readRoom(code, credential);
    if (result === 'roster_changed') continue;
    if (result === 'unavailable') throw unavailable();
    if (result === 'invalid_identity')
      throw new RoomError(
        'invalid_identity',
        401,
        'Your saved access is missing or invalid. Your name and room code cannot recover it.',
      );
    if (result === 'owner_only')
      throw new RoomError(
        'owner_only',
        403,
        'Only the room owner can draw names.',
      );
    if (result === 'insufficient_membership')
      throw new RoomError(
        'insufficient_membership',
        409,
        'A draw needs at least three participants.',
      );
    throw new Error('Unexpected draw response');
  }
  throw new RoomError(
    'roster_changed',
    409,
    'The participant list changed. Check everyone is here and try again.',
  );
}
