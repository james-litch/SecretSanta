import { NextRequest } from 'next/server';
import { drawRoom } from '../../../../../lib/rooms/storage';
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
        message: 'Open this site directly to draw names.',
      },
      403,
    );
  try {
    const { code } = await context.params;
    return privateJson(
      await drawRoom(code, request.cookies.get('room_access')?.value),
    );
  } catch (error) {
    return operationError(error);
  }
}
