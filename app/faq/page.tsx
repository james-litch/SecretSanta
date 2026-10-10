'use client';
import { Divider } from '@/components/Divider/Divider';
import { useAutoFocus } from '@/hooks/useAutoFocus';
import { Disclosure } from '@/components/Disclosure/Disclosure';

export default function FAQ() {
  const headingProps = useAutoFocus<HTMLHeadingElement>();
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
        question="Can I switch browsers or share a device?"
      >
        <p className="mb-4">
          Access stays in the original browser profile. People sharing a device
          need separate browsers or profiles. There is no identity switcher or
          recovery link.
        </p>
      </Disclosure>
      <Disclosure id="owner" question="What if the room owner loses access?">
        <p className="mb-4">
          If the owner loses access before drawing, the group needs a new room.
          There is no ownership transfer or identity recovery.
        </p>
      </Disclosure>
      <Disclosure id="changes" question="Can I change my name or leave?">
        <p className="mb-4">
          Membership cannot be removed or corrected in place. Start a new room
          if you need to make a correction.
        </p>
      </Disclosure>
      <Disclosure id="capacity" question="How many people can take part?">
        <p className="mb-4">
          Each room shows its participant limit, including the owner. A draw
          requires at least three participants. Drawing is coming in a later
          update.
        </p>
      </Disclosure>
      <Disclosure id="expiry" question="When is the room deleted?">
        <p className="mb-4">
          The lifetime shown in your room is fixed when it is created. Returning
          does not extend it. Missing or expired rooms cannot be restored. Rooms
          may also become unavailable if stored data is lost.
        </p>
      </Disclosure>
      <Disclosure id="connection" question="What happens if I lose connection?">
        <p className="mb-4">
          Reconnect before submitting. If creating or joining is uncertain,
          choose Try again to check the same attempt with the same name and room
          code. Pending attempts are kept in this tab for up to 15 minutes.
          Abandoning an attempt can leave a created room behind; it expires
          normally. Never clear browser data to fix a connection problem.
        </p>
      </Disclosure>
      <Divider />
    </main>
  );
}
