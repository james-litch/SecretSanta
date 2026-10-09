import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { SystemMessage } from './SystemMessage';

const meta = {
  component: SystemMessage,
  parameters: { layout: 'padded' },
  args: {
    role: 'alert',
    children:
      'We couldn’t reach the room service. Try again using this same create attempt.',
  },
} satisfies Meta<typeof SystemMessage>;
export default meta;

type Story = StoryObj<typeof meta>;

export const ServiceFailure: Story = {};
export const Offline: Story = {
  args: {
    role: 'status',
    children: 'You’re offline. Reconnect before creating a room.',
  },
};
export const WithHelpLink: Story = {
  args: {
    children: (
      <>
        <p className="mb-3">
          We couldn’t reach the room service. Try again using this same create
          attempt.
        </p>
        <a href="/faq#connection" className="inline-block">
          Help with connection problems
        </a>
      </>
    ),
  },
};
