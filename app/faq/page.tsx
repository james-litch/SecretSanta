'use client';
import { Divider } from '@/components/Divider/Divider';
import { useAutoFocus } from '@/hooks/useAutoFocus';
import { Disclosure } from '@/components/Disclosure/Disclosure';

export default function FAQ() {
  const headingProps = useAutoFocus<HTMLHeadingElement>(true);
  return (
    <main className="mx-auto max-w-3xl px-6 py-14 text-center max-md:pt-10">
      <h1
        className="mb-5 font-display text-fl-xl font-normal tracking-tight text-balance focus:outline-none"
        {...headingProps}
      >
        A few helpful answers
      </h1>
      <Disclosure id="browser" question="How do I return to my room?">
        <p className="mb-4">
          Keep your room’s page address and open it in the same browser you used
          to create or join it. Refreshing or opening another tab keeps your
          identity. Clearing saved browser data loses access; your name and room
          code cannot recover it.
        </p>
      </Disclosure>
      <Disclosure
        id="devices"
        question="Can I switch devices or share a device?"
      >
        <p className="mb-4">
          Access stays in the original browser profile and cannot move to
          another device or browser. People sharing a device need separate
          browsers or profiles. There is no identity switcher or recovery link.
          Read more about <a href="#browser">returning to your room</a>.
        </p>
      </Disclosure>
      <Disclosure id="owner" question="What if the room owner loses access?">
        <p className="mb-4">
          If the owner loses access before drawing, the group needs a new room.
          There is no ownership transfer or identity recovery. After drawing,
          other participants can still see their own saved recipients.
        </p>
      </Disclosure>
      <Disclosure id="changes" question="Can I change my name or leave?">
        <p className="mb-4">
          There is no leaving or participant removal. Names and membership
          cannot be corrected in place. Start a new room if you need to make a
          correction.
        </p>
      </Disclosure>
      <Disclosure id="capacity" question="How many people can take part?">
        <p className="mb-4">
          Each room shows its participant limit, including the owner. A draw
          requires at least three participants. A full room cannot accept new
          participants.
        </p>
      </Disclosure>
      <Disclosure id="sharing" question="Who can join using the room code?">
        <p className="mb-4">
          Share the code only with people you want to take part. Anyone with a
          forwarded code can join before the draw, while there is space, without
          owner approval. The owner can be offline while others join. Drawing
          closes joining permanently; there are no late joins or reopening.
        </p>
      </Disclosure>
      <Disclosure id="draw" question="Can we draw names again?">
        <p className="mb-4">
          Only the room owner can start the one-time draw, once everyone is
          present. It cannot be undone or repeated. In the saved draw, everyone
          gives and receives exactly once and nobody gets themselves. Every
          valid complete assignment is equally likely. Reciprocal pairs are
          possible; the owner cannot preview or influence the result. Retrying
          or using another tab never changes a saved draw.
        </p>
      </Disclosure>
      <Disclosure id="privacy" question="Who can see my gift recipient?">
        <p className="mb-4">
          Only you can see your gift recipient through your browser’s private
          access. Other participants, including the room owner, cannot see your
          assignment. It appears as soon as the saved draw is known; there is no
          separate reveal and you do not all need to be online together. Your
          room code and participant list remain available after drawing.
        </p>
      </Disclosure>
      <Disclosure id="expiry" question="When is the room deleted?">
        <p className="mb-4">
          The lifetime shown in your room is fixed when it is created. Returning
          does not extend it, and neither does joining, retrying or drawing.
          Results become unavailable at that original deadline, even offline.
          Missing or expired rooms cannot be restored. Rooms may also become
          unavailable if stored data is lost.
        </p>
      </Disclosure>
      <Disclosure id="connection" question="What happens if I lose connection?">
        <p className="mb-4">
          Reconnect before submitting. If creating or joining is uncertain,
          choose Try again to check the same attempt with the same name and room
          code. Pending attempts are kept in this tab for up to 15 minutes.
          Abandoning an attempt can leave a created room behind; it expires
          normally. A successful join can still be recovered after the room
          fills or draws, while the pending attempt and room are still valid.
        </p>
        <p className="mb-4">
          If a draw response is uncertain, the app checks whether the draw
          completed. Try again checks the saved outcome before retrying; it
          never replaces a saved draw. During a temporary connection problem,
          the last known room stays visible with a connection warning until its
          original expiry. It may be out of date. Reconnecting refreshes a
          waiting room. Never clear browser data to fix a connection problem.
        </p>
      </Disclosure>
      <Divider />
    </main>
  );
}
