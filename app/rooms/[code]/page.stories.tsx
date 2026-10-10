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
    await userEvent.click(canvas.getByRole('button', { name: 'Try again' }));
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
