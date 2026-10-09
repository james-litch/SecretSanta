import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
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

export async function readRoom(
  code: string,
  credential?: string,
): Promise<RoomView> {
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
  const currentParticipantId = entry[1];
  return {
    code,
    state: 'waiting',
    expiresAt: Number(data.expiresAt),
    capacity: Number(data.capacity),
    lifetimeDays: Number(data.lifetimeDays),
    ownerId: data.ownerId,
    currentParticipantId,
    isOwner: data.ownerId === currentParticipantId,
    participants: JSON.parse(data.participants),
  };
}
