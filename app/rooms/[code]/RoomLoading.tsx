import { Button } from '@/components/Button/Button';
import { SystemMessage } from '@/components/SystemMessage/SystemMessage';
import { useAutoFocus } from '@/hooks/useAutoFocus';
import Link from 'next/link';

interface Props {
  error: string;
  busy: boolean;
  load: () => void;
}

export function RoomLoading({ error, busy, load }: Props) {
  const headingProps = useAutoFocus<HTMLHeadingElement>();
  return (
    <main className="mx-auto max-w-2xl px-6 py-14 text-center max-md:pt-10">
      <h1
        className="mb-5 font-display text-fl-xl font-normal tracking-tight text-balance focus:outline-none"
        {...headingProps}
      >
        Opening your room...
      </h1>

      {error && (
        <SystemMessage className="my-4" role="alert">
          <p className="mb-4 text-xl">{error}</p>
          <div className="space-x-4">
            <Button disabled={busy} onClick={load}>
              {busy ? 'Checking…' : 'Try again'}
            </Button>

            <Link href="/faq#browser">About room access</Link>
          </div>
        </SystemMessage>
      )}
    </main>
  );
}
