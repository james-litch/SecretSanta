import { NextRequest } from 'next/server';
import { joinRoom, RoomError } from '../../../../../lib/rooms/storage';
import { normalizeName } from '../../../../../lib/rooms/rules';
import { privateJson, operationError } from '../../../../../lib/rooms/http';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ code: string }> },
) {
  const url = new URL(request.url);
  const expectedOrigin = `${url.protocol}//${request.headers.get('host') ?? url.host}`;
  if (
    request.headers.get('origin') !== expectedOrigin ||
    request.headers.get('sec-fetch-site') === 'cross-site'
  )
    return privateJson(
      {
        error: 'invalid_origin',
        message: 'Open this site directly to join a room.',
      },
      403,
    );
  try {
    const { code } = await context.params;
    if (!/^[A-F0-9]{24}$/.test(code))
      return privateJson(
        {
          error: 'invalid_code',
          field: 'code',
          message: 'Enter the complete room code shared with you.',
        },
        400,
      );
    if (!request.headers.get('content-type')?.startsWith('application/json'))
      throw new RoomError('invalid_input', 400, 'Send a JSON join request.');
    const text = await request.text();
    if (text.length > 4096)
      throw new RoomError(
        'invalid_input',
        400,
        'The join request is too large.',
      );
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      throw new RoomError('invalid_input', 400, 'The join request is invalid.');
    }
    try {
      normalizeName(body?.name);
    } catch (error) {
      return privateJson(
        {
          error: 'invalid_name',
          field: 'name',
          message: (error as Error).message,
        },
        400,
      );
    }
    if (typeof body.secret !== 'string')
      throw new RoomError(
        'invalid_operation',
        400,
        'The join attempt is invalid.',
      );
    const { room, credential, joined } = await joinRoom(
      code,
      body,
      request.cookies.get('room_access')?.value,
    );
    const response = privateJson(room, joined ? 201 : 200);
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
