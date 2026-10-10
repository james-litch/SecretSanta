import { SystemMessage } from '@/components/SystemMessage/SystemMessage';
import { useAutoFocus } from '@/hooks/useAutoFocus';
import Link from 'next/link';

interface Props {
  error: string;
}

export function RoomUnavailable({ error }: Props) {
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

          <a href="/faq#browser">About room access</a>
        </SystemMessage>
      )}

      <Link className="button" href="/">
        Back to the landing page
      </Link>
    </main>
  );
}
