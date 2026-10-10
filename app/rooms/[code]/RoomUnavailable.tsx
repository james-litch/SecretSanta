import { SystemMessage } from '@/components/SystemMessage/SystemMessage';
import { useAutoFocus } from '@/hooks/useAutoFocus';
import Link from 'next/link';

interface Props {
  error: string;
  reason: 'unavailable' | 'access';
}

export function RoomUnavailable({ error, reason }: Props) {
  const headingProps = useAutoFocus<HTMLHeadingElement>();
  return (
    <main className="mx-auto max-w-2xl px-6 py-14 text-center max-md:pt-10">
      <h1
        className="mb-5 font-display text-fl-xl font-normal tracking-tight text-balance focus:outline-none"
        {...headingProps}
      >
        Room unavailable
      </h1>

      {error && (
        <SystemMessage className="my-4" role="alert">
          <p className="mb-4 text-xl">{error}</p>

          <a href={reason === 'access' ? '/faq#browser' : '/faq#expiry'}>
            {reason === 'access' ? 'About room access' : 'About room expiry'}
          </a>
        </SystemMessage>
      )}

      {reason === 'access' && (
        <>
          <p className="mb-4">
            Open the room in the browser profile you used to create or join it.
            Clearing its saved data loses your access. Your name and room code
            cannot recover it.
          </p>
          <p className="mb-4">
            There is no identity recovery or ownership transfer.
          </p>
          <p className="mb-4">
            If the room owner loses access before drawing, the group needs a new
            room. After drawing, other participants can still see their own
            saved recipients.
          </p>
          <p className="mb-6">
            <a href="/faq#owner">About lost owner access</a>
          </p>
        </>
      )}

      <Link className="button" href="/">
        Back to the landing page
      </Link>
    </main>
  );
}
