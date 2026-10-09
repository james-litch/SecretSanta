import { roomConfig } from './lib/rooms/rules';
export function register() {
  roomConfig(process.env);
}
