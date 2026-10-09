'use client';
import { useCreateRoom } from '@/hooks/useCreateRoom';
import { useAutoFocus } from '@/hooks/useAutoFocus';
import { Button } from '@/components/Button/Button';
import { FormField } from '@/components/FormField/FormField';
import { Divider } from '@/components/Divider/Divider';
import { SystemMessage } from '@/components/SystemMessage/SystemMessage';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const {
    name,
    setName,
    fieldError,
    setFieldError,
    error,
    busy,
    online,
    pending,
    input,
    submit,
    startOver,
  } = useCreateRoom((code) => router.push(`/rooms/${code}`));
  const headingProps = useAutoFocus<HTMLHeadingElement>();
  return (
    <main className="mx-auto grid max-w-6xl grid-cols-2 items-center gap-16 px-8 py-12 lg:py-28 max-md:grid-cols-1 max-md:gap-8 max-md:px-5 max-md:pt-10 max-md:pb-20">
      <section className="text-center">
        <p className="mb-6 text-xs tracking-widest text-green-muted uppercase">
          A little festive tradition
        </p>
        <h1
          className="mb-5 font-display text-fl-xl font-normal tracking-tight text-balance focus:outline-none"
          {...headingProps}
        >
          A little mystery.
          <br />A lot of joy.
        </h1>
        <Divider />
        <p className="mb-4 text-lg">A gift exchange for friends and family.</p>
      </section>
      <form
        className="rounded-lg border border-cream-dark bg-cream-light p-8 max-md:p-6"
        onSubmit={submit}
        noValidate
        aria-busy={busy}
      >
        <FormField
          id="name"
          label="Your name"
          hint="The name your group will see. Up to 40 characters."
          error={fieldError}
          ref={input}
          value={name}
          readOnly={busy || !!pending}
          autoComplete="given-name"
          onChange={(event) => {
            setName(event.target.value);
            setFieldError('');
          }}
        />
        <Button className="w-full" disabled={busy || !online} type="submit">
          {busy ? 'Creating your room…' : pending ? 'Try again' : 'Create room'}
        </Button>
        <div role="status" aria-live="polite">
          {!online && (
            <SystemMessage className="my-3">
              You’re offline. Reconnect before creating a room.
            </SystemMessage>
          )}
          {busy && (
            <SystemMessage className="mb-4 mt-2.5">
              Keep this page open while we create your room.
            </SystemMessage>
          )}
        </div>
        {error && (
          <SystemMessage className="my-3" role="alert">
            {error}{' '}
            <a className="inline-block" href="/faq#connection">
              Help with connection problems
            </a>
          </SystemMessage>
        )}
        {pending && !busy && (
          <Button
            type="button"
            variant="text"
            className="w-full"
            onClick={startOver}
          >
            Abandon this attempt and start a new room
          </Button>
        )}
        <Divider />
        <p className="mx-auto mb-4 max-w-lg text-sm text-green-muted">
          Return using this same browser. Clearing its saved data loses your
          access.
        </p>
        <a className="block text-center text-sm" href="/faq#browser">
          How your private access works
        </a>
      </form>
    </main>
  );
}
