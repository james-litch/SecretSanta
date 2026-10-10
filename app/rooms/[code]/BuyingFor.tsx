interface Props {
  name: string;
}

export function BuyingFor({ name }: Props) {
  return (
    <section
      aria-label="Your private gift recipient"
      className="mb-6 rounded-lg border border-cream-dark bg-cream-light px-6 py-8"
    >
      <p className="mb-3 text-lg">You’re buying a gift for…</p>
      <p className="mb-4 font-display text-fl-xl text-green-dark wrap-anywhere">
        {name}
      </p>
      <p className="text-sm text-green-muted">
        Only you can see your gift recipient.
      </p>
    </section>
  );
}
