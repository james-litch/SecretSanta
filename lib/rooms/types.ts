export type RoomView = {
  code: string;
  state: 'waiting';
  expiresAt: number;
  capacity: number;
  lifetimeDays: number;
  ownerId: string;
  currentParticipantId: string;
  isOwner: boolean;
  participants: { id: string; name: string }[];
};
export type PendingCreate = { name: string; secret: string };
