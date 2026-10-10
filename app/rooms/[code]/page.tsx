'use client';
import { Button } from '@/components/Button/Button';
import { Divider } from '@/components/Divider/Divider';
import { Modal } from '@/components/Modal/Modal';
import { RoomCodeShareCard } from '@/components/RoomCodeShareCard/RoomCodeShareCard';
import { SystemMessage } from '@/components/SystemMessage/SystemMessage';
import { useAutoFocus } from '@/hooks/useAutoFocus';
import { useRoom } from '@/hooks/useRoom';
import { lifetimeCopy } from '@/lib/rooms/rules';
import { useParams } from 'next/navigation';
import { Suspense } from 'react';
import { BuyingFor } from './BuyingFor';
import { RoomLoading } from './RoomLoading';
import { RoomUnavailable } from './RoomUnavailable';

export default function RoomPage() {
  return (
    <Suspense fallback={<RoomLoading error="" busy load={() => {}} />}>
      <Room />
    </Suspense>
  );
}

function Room() {
  const { code } = useParams<{ code: string }>();
  return <RoomContent key={code} code={code} />;
}

function RoomContent({ code }: { code: string }) {
  const {
    room,
    error,
    terminal,
    busy,
    load,
    draw,
    retry,
    offline,
    uncertain,
    announcement,
  } = useRoom(code);
  const headingProps = useAutoFocus<HTMLHeadingElement>();

  if (!room && terminal) return <RoomUnavailable error={error} />;
  if (!room) return <RoomLoading error={error} busy={busy} load={load} />;
  return (
    <main className="mx-auto max-w-2xl px-6 py-14 text-center max-md:pt-10">
      <h1
        key={room.state}
        className="mb-5 font-display text-fl-xl font-normal tracking-tight text-balance focus:outline-none"
        {...headingProps}
      >
        {room.state === 'drawn' ? 'Your gift recipient' : 'Your room'}
      </h1>
      {room.state === 'drawn' && room.recipient ? (
        <BuyingFor name={room.recipient?.name} />
      ) : (
        <p className="mb-4 text-green-muted">
          A little gathering. A lovely surprise.
        </p>
      )}
      {error && (
        <SystemMessage className="my-4" role="alert">
          <p className="mb-4">{error}</p>
          <Button disabled={busy || offline} onClick={retry}>
            {busy ? 'Checking…' : 'Try again'}
          </Button>
        </SystemMessage>
      )}
      <p role="status" aria-label="Room updates" className="sr-only">
        {announcement}
      </p>
      <RoomCodeShareCard code={room.code} className="mb-6" />
      <p className="mb-2 text-left">
        {room.participants.length}{' '}
        {room.participants.length === 1 ? 'participant' : 'participants'} · up
        to {room.capacity}
      </p>

      <ul
        className="mb-6 list-none rounded-lg border border-cream-dark bg-cream-light p-0 text-left"
        aria-label="Participants"
      >
        {room.participants.map((participant) => (
          <li
            key={participant.id}
            className="flex flex-wrap gap-3 border-t items-center border-cream-dark px-4 py-3 wrap-anywhere first:border-t-0"
          >
            <span>{participant.name}</span>
            <span className="text-sm text-green-muted">
              {participant.id === room.currentParticipantId ? 'You' : ''}
              {participant.id === room.ownerId
                ? `${participant.id === room.currentParticipantId ? ' · ' : ''}Room owner`
                : ''}
            </span>
          </li>
        ))}
      </ul>
      {room.state === 'waiting' &&
        (room.isOwner ? (
          !uncertain && (
            <>
              <Button
                className="w-full"
                disabled={room.participants.length < 3 || busy || offline}
                aria-describedby="draw-minimum"
                command="show-modal"
                commandfor="draw-confirmation"
              >
                Draw names
              </Button>
              <p
                id="draw-minimum"
                className="mb-4 mt-3 text-sm text-green-muted"
              >
                A draw needs at least three participants.
              </p>
              <Modal
                id="draw-confirmation"
                title="Draw names?"
                aria-describedby="draw-description"
              >
                <p id="draw-description" className="mb-6">
                  Everyone here? Drawing closes joining and can’t be undone.
                </p>
                <div className="flex flex-wrap justify-end gap-3">
                  <Button
                    disabled={busy || offline}
                    command="close"
                    commandfor="draw-confirmation"
                    onClick={draw}
                  >
                    Confirm draw
                  </Button>
                </div>
              </Modal>
            </>
          )
        ) : (
          <p className="mb-4 mt-2.5 text-sm text-green-muted">
            Waiting for the room owner to draw.
          </p>
        ))}
      <Divider />
      <p className="mx-auto mb-4 max-w-lg text-sm text-green-muted">
        Return using this same browser. Clearing its saved data loses your
        access.
      </p>
      <p className="mb-4 text-sm text-green-muted">
        {lifetimeCopy(room.lifetimeDays)}
      </p>
    </main>
  );
}
