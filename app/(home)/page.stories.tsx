import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { http, HttpResponse, delay } from 'msw';
import Home from './page';
import { useRouter } from '@storybook/nextjs-vite/navigation.mock';

const meta = {
  parameters: { appLayout: true },
  title: 'Pages/Home',
  component: Home,
  beforeEach: () => {
    // Mock navigation directly: Storybook's App Router provider predates Next's render tree.
    useRouter.mockReturnValue({
      push: fn(),
      replace: fn(),
      back: fn(),
      forward: fn(),
      refresh: fn(),
      prefetch: fn(),
      bfcacheId: 'home-story',
    });
    sessionStorage.removeItem('secret-santa:pending-create');
    sessionStorage.removeItem('secret-santa:pending-join');
  },
} satisfies Meta<typeof Home>;
export default meta;

type Story = StoryObj<typeof meta>;
export const Default: Story = {};

export const Validation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Create room' }));
    await expect(canvas.getByLabelText('Your name')).toHaveFocus();
    await expect(canvas.getByLabelText('Your name')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    await expect(canvas.getByRole('alert')).toHaveTextContent(
      'Enter a name between 1 and 40 characters.',
    );
  },
};
export const Pending: Story = {
  parameters: {
    msw: {
      handlers: [
        http.post('/api/rooms', async ({ request }) => {
          const body = (await request.json()) as {
            phase?: string;
            name: string;
          };
          if (body.phase === 'prepare')
            return HttpResponse.json({
              name: body.name,
              secret: 'a'.repeat(64),
            });
          await delay('infinite');
          return HttpResponse.json({});
        }),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Your name'), 'James');
    await userEvent.click(canvas.getByRole('button', { name: 'Create room' }));
    await expect(
      canvas.getByRole('button', { name: 'Creating your room…' }),
    ).toBeDisabled();
    await expect(canvas.getByLabelText('Your name')).toHaveAttribute(
      'readonly',
    );
  },
};
export const ServiceFailure: Story = {
  parameters: {
    msw: {
      handlers: [
        http.post('/api/rooms', async ({ request }) => {
          const body = (await request.json()) as {
            phase?: string;
            name: string;
          };
          if (body.phase === 'prepare')
            return HttpResponse.json({
              name: body.name,
              secret: 'a'.repeat(64),
            });
          return HttpResponse.json(
            {
              error: 'service_unavailable',
              message:
                'We couldn’t reach the room service. Try again using this same create attempt.',
            },
            { status: 503 },
          );
        }),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Your name'), 'James');
    await userEvent.click(canvas.getByRole('button', { name: 'Create room' }));
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'Try again',
    );
    await expect(canvas.getByLabelText('Your name')).toHaveValue('James');
  },
};

export const JoinValidation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Join room' }));
    await expect(canvas.getByLabelText('Your name')).toHaveFocus();
    await userEvent.type(canvas.getByLabelText('Your name'), 'Sam');
    await userEvent.click(canvas.getByRole('button', { name: 'Join room' }));
    await expect(canvas.getByLabelText('Room code')).toHaveFocus();
    await expect(canvas.getByLabelText('Room code')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  },
};
export const DuplicateName: Story = {
  parameters: {
    msw: {
      handlers: [
        http.post('/api/rooms/:code/join', () =>
          HttpResponse.json(
            {
              error: 'duplicate_name',
              message:
                'Someone in this room already uses that name. Choose a distinguishable name.',
            },
            { status: 409 },
          ),
        ),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Your name'), 'Sam');
    await userEvent.type(canvas.getByLabelText('Room code'), 'A'.repeat(24));
    await userEvent.click(canvas.getByRole('button', { name: 'Join room' }));
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'already uses that name',
    );
    await expect(canvas.getByLabelText('Your name')).toHaveFocus();
    await expect(canvas.getByLabelText('Room code')).toHaveValue(
      'A'.repeat(24),
    );
  },
};
export const PendingJoin: Story = {
  parameters: {
    msw: {
      handlers: [
        http.post('/api/rooms/:code/join', async () => {
          await delay('infinite');
          return HttpResponse.json({});
        }),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Your name'), 'Sam');
    await userEvent.type(canvas.getByLabelText('Room code'), 'A'.repeat(24));
    await userEvent.click(canvas.getByRole('button', { name: 'Join room' }));
    await expect(
      canvas.getByRole('button', { name: 'Joining your room…' }),
    ).toBeDisabled();
    await expect(
      canvas.getByRole('button', { name: 'Create room' }),
    ).toBeDisabled();
    await expect(canvas.getByLabelText('Room code')).toHaveAttribute(
      'readonly',
    );
  },
};
