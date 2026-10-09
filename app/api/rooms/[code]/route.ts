import { NextRequest } from 'next/server';
import { readRoom } from '../../../../lib/rooms/storage';
import { privateJson, operationError } from '../../../../lib/rooms/http';
// Cache Components uses the default Node.js runtime; segment runtime overrides are unsupported.
export async function GET(request: NextRequest, context: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await context.params;
    return privateJson(await readRoom(code, request.cookies.get('room_access')?.value));
  } catch (error) { return operationError(error); }
}
