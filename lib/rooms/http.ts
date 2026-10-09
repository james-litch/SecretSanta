import { NextResponse } from 'next/server';
import { RoomError } from './storage';
export function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie', 'X-Content-Type-Options': 'nosniff' } });
}
export function operationError(error: unknown) {
  return error instanceof RoomError
    ? privateJson({ error: error.code, message: error.message }, error.status)
    : privateJson({ error: 'service_unavailable', message: 'We couldn’t reach the room service. Try again using this same create attempt.' }, 503);
}
