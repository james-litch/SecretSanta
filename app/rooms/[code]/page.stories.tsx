import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, within, waitFor, userEvent } from 'storybook/test';
import { http, HttpResponse } from 'msw';
import Room from './page';
import { useParams } from '@storybook/nextjs-vite/navigation.mock';

const room = {
  code: 'ABCDEF0123456789ABCDEF01',
  state: 'waiting',
  expiresAt: Date.now() + 86_400_000,
  capacity: 12,
  lifetimeDays: 1,
  ownerId: 'owner',
  currentParticipantId: 'owner',
  isOwner: true,
  participants: [{ id: 'owner', name: 'James' }],
};

const meta = {
  parameters: { appLayout: true },
  beforeEach: () => {
    // Use the public navigation mock until Storybook supports Next's render tree.
    useParams.mockReturnValue({ code: room.code });
  },
  title: 'Pages/Room',
  component: Room,
} satisfies Meta<typeof Room>;
export default meta;

type Story = StoryObj<typeof meta>;
export const Owner: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get(`/api/rooms/${room.code}`, () => HttpResponse.json(room)),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('heading', { name: 'Your room' });
    await waitFor(() =>
      expect(canvas.getByRole('heading', { name: 'Your room' })).toHaveFocus(),
    );
    await expect(canvas.getByText('You · Room owner')).toBeVisible();
    await expect(
      canvas.getByText('This room will be deleted after 1 day.'),
    ).toBeVisible();
  },
};
export const Unavailable: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const heading = await canvas.findByRole('heading', {
      name: 'Room unavailable',
    });
    await waitFor(() => expect(heading).toHaveFocus());
    await expect(
      canvas.getByRole('link', { name: 'About room expiry' }),
    ).toHaveAttribute('href', '/faq#expiry');
    await expect(
      canvas.getByRole('link', { name: 'Back to the landing page' }),
    ).toHaveAttribute('href', '/');
  },
  parameters: {
    msw: {
      handlers: [
        http.get(`/api/rooms/${room.code}`, () =>
          HttpResponse.json(
            {
              error: 'unavailable',
              message: 'This room doesn’t exist or has expired.',
            },
            { status: 404 },
          ),
        ),
      ],
    },
  },
};
export const MissingAccessAfterDraw: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get(`/api/rooms/${room.code}`, () =>
          HttpResponse.json(
            {
              error: 'invalid_identity',
              message:
                'This room has already drawn. Open it in the browser you used to join.',
            },
            { status: 401 },
          ),
        ),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const heading = await canvas.findByRole('heading', {
      name: 'Room unavailable',
    });
    await waitFor(() => expect(heading).toHaveFocus());
    await expect(
      canvas.getByText(
        'This room has already drawn. Open it in the browser you used to join.',
      ),
    ).toBeVisible();
    await expect(
      canvas.queryByRole('list', { name: 'Participants' }),
    ).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole('region', { name: 'Your private gift recipient' }),
    ).not.toBeInTheDocument();
    await expect(
      canvas.getByRole('link', { name: 'About lost owner access' }),
    ).toHaveAttribute('href', '/faq#owner');
  },
};
export const InvalidAccess: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get(`/api/rooms/${room.code}`, () =>
          HttpResponse.json(
            {
              error: 'invalid_identity',
              message:
                'Your saved access is missing or invalid. Your name and room code cannot recover it.',
            },
            { status: 401 },
          ),
        ),
      ],
    },
  },
};
export const ConnectionFailure: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get(`/api/rooms/${room.code}`, () =>
          HttpResponse.json({ error: 'service_unavailable' }, { status: 503 }),
        ),
      ],
    },
  },
};

export const LoadedConnectionFailure: Story = {
  parameters: Owner.parameters,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const heading = await canvas.findByRole('heading', { name: 'Your room' });
    await waitFor(() => expect(heading).toHaveFocus());
    window.dispatchEvent(new Event('offline'));
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'last confirmed earlier',
    );
    await expect(canvas.getByText('You · Room owner')).toBeVisible();
    window.dispatchEvent(new Event('online'));
    await waitFor(() =>
      expect(canvas.queryByRole('alert')).not.toBeInTheDocument(),
    );
    await expect(canvas.getByText('You · Room owner')).toBeVisible();
  },
};

export const Participant: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get(`/api/rooms/${room.code}`, () =>
          HttpResponse.json({
            ...room,
            currentParticipantId: 'sam',
            isOwner: false,
            participants: [...room.participants, { id: 'sam', name: 'Sam' }],
          }),
        ),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText('Waiting for the room owner to draw.'),
    ).toBeVisible();
    await expect(canvas.getByText('2 participants · up to 12')).toBeVisible();
    await expect(canvas.getByText('Room owner', { exact: true })).toBeVisible();
  },
};

const readyRoom = {
  ...room,
  participants: [
    ...room.participants,
    { id: 'sam', name: 'Sam' },
    { id: 'alex', name: 'Alex' },
  ],
};
export const ConfirmDraw: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get(`/api/rooms/${room.code}`, () => HttpResponse.json(readyRoom)),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = await canvas.findByRole('button', { name: 'Draw names' });
    await userEvent.click(trigger);
    const dialog = await canvas.findByRole('dialog', { name: 'Draw names?' });
    await waitFor(() => expect(dialog).toBeVisible());
    await expect(
      within(dialog).getByRole('button', { name: 'Close modal' }),
    ).toHaveFocus();
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Close modal' }),
    );
    await waitFor(() => expect(trigger).toHaveFocus());
    await userEvent.click(trigger);
  },
};

export const PrivateResult: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get(`/api/rooms/${room.code}`, () =>
          HttpResponse.json({
            ...readyRoom,
            state: 'drawn',
            recipient: { id: 'alex', name: 'Alex' },
          }),
        ),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const heading = await canvas.findByRole('heading', {
      name: 'Your gift recipient',
    });
    await waitFor(() => expect(heading).toHaveFocus());
    await expect(
      canvas.getByRole('region', { name: 'Your private gift recipient' }),
    ).toHaveTextContent('Alex');
    await expect(
      canvas.queryByRole('button', { name: 'Draw names' }),
    ).not.toBeInTheDocument();
    await expect(
      canvas.getByRole('list', { name: 'Participants' }),
    ).toBeVisible();
  },
};

export const DrawRejected: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get(`/api/rooms/${room.code}`, () => HttpResponse.json(readyRoom)),
        http.post(`/api/rooms/${room.code}/draw`, () =>
          HttpResponse.json(
            {
              error: 'insufficient_membership',
              message: 'A draw needs at least three participants.',
            },
            { status: 409 },
          ),
        ),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = await canvas.findByRole('button', { name: 'Draw names' });
    await userEvent.click(trigger);
    await userEvent.click(canvas.getByRole('button', { name: 'Confirm draw' }));
    await waitFor(() =>
      expect(canvas.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'A draw needs at least three participants.',
    );
    await userEvent.click(trigger);
    await waitFor(() =>
      expect(canvas.getByRole('dialog', { name: 'Draw names?' })).toBeVisible(),
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Close modal' }));
    await waitFor(() =>
      expect(canvas.queryByRole('dialog')).not.toBeInTheDocument(),
    );
  },
};

export const UncertainDraw: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get(`/api/rooms/${room.code}`, () => HttpResponse.json(readyRoom)),
        http.post(`/api/rooms/${room.code}/draw`, () => HttpResponse.error()),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Draw names' }),
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Confirm draw' }));
    await waitFor(() =>
      expect(canvas.getByRole('alert')).toHaveTextContent(
        'No saved draw was found yet',
      ),
    );
    await expect(
      canvas.getByRole('button', { name: 'Try again' }),
    ).toBeEnabled();
    await expect(
      canvas.getByRole('list', { name: 'Participants' }),
    ).toBeVisible();
  },
};

export const Reconnecting: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get(
          `/api/rooms/${room.code}`,
          () => HttpResponse.json(readyRoom),
          { once: true },
        ),
        http.get(`/api/rooms/${room.code}`, () =>
          HttpResponse.json({ error: 'service_unavailable' }, { status: 503 }),
        ),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('list', { name: 'Participants' });
    await waitFor(
      () =>
        expect(canvas.getByRole('alert')).toHaveTextContent(
          'Reconnecting automatically',
        ),
      { timeout: 5000 },
    );
    await expect(
      canvas.getByRole('list', { name: 'Participants' }),
    ).toHaveTextContent('Sam');
  },
};

export const Offline: Story = {
  parameters: ConfirmDraw.parameters,
  beforeEach: () => {
    const descriptor = Object.getOwnPropertyDescriptor(navigator, 'onLine');
    return () => {
      if (descriptor) Object.defineProperty(navigator, 'onLine', descriptor);
      else Reflect.deleteProperty(navigator, 'onLine');
      window.dispatchEvent(new Event('online'));
    };
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('list', { name: 'Participants' });
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: false,
    });
    window.dispatchEvent(new Event('offline'));
    await waitFor(() =>
      expect(canvas.getByRole('alert')).toHaveTextContent('You’re offline'),
    );
    await expect(
      canvas.getByRole('button', { name: 'Draw names' }),
    ).toBeDisabled();
    await expect(
      canvas.getByRole('button', { name: 'Try again' }),
    ).toBeDisabled();
    await expect(
      canvas.getByRole('list', { name: 'Participants' }),
    ).toHaveTextContent('Sam');
  },
};
