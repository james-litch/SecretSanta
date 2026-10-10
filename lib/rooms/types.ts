export type RoomView = {
  code: string;
  state: 'waiting' | 'drawn';
  recipient?: { id: string; name: string };
  expiresAt: number;
  capacity: number;
  lifetimeDays: number;
  ownerId: string;
  currentParticipantId: string;
  isOwner: boolean;
  participants: { id: string; name: string }[];
};
export type PendingCreate = { name: string; secret: string };
