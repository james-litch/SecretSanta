import { NextRequest } from 'next/server';
import {
  createRoom,
  prepareCreate,
  RoomError,
} from '../../../lib/rooms/storage';
import { normalizeName } from '../../../lib/rooms/rules';
import { privateJson, operationError } from '../../../lib/rooms/http';
// Cache Components uses the default Node.js runtime; segment runtime overrides are unsupported.

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  // Next's internal request URL may use localhost; Host retains the browser-facing authority.
  const expectedOrigin = `${url.protocol}//${request.headers.get('host') ?? url.host}`;
  if (
    request.headers.get('origin') !== expectedOrigin ||
    request.headers.get('sec-fetch-site') === 'cross-site'
  ) {
    return privateJson(
      {
        error: 'invalid_origin',
        message: 'Open this site directly to create a room.',
      },
      403,
    );
  }
  try {
    if (!request.headers.get('content-type')?.startsWith('application/json'))
      throw new RoomError('invalid_input', 400, 'Send a JSON create request.');
    const text = await request.text();
    if (text.length > 4096)
      throw new RoomError(
        'invalid_input',
        400,
        'The create request is too large.',
      );
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      throw new RoomError(
        'invalid_input',
        400,
        'The create request is invalid.',
      );
    }
    if (!body || typeof body !== 'object')
      throw new RoomError(
        'invalid_input',
        400,
        'The create request is invalid.',
      );
    try {
      normalizeName(body.name);
    } catch (error) {
      return privateJson(
        {
          error: 'invalid_name',
          message: (error as Error).message,
          field: 'name',
        },
        400,
      );
    }
    if (body.phase === 'prepare') {
      return privateJson(await prepareCreate(body.name), 201);
    }
    if (typeof body.secret !== 'string')
      throw new RoomError(
        'invalid_operation',
        400,
        'The create attempt is invalid.',
      );
    const { room, credential, created } = await createRoom(body);
    const response = privateJson(room, created ? 201 : 200);
    response.cookies.set('room_access', credential, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: `/api/rooms/${room.code}`,
      expires: new Date(room.expiresAt),
    });
    return response;
  } catch (error) {
    return operationError(error);
  }
}
