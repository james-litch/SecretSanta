import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Disclosure } from './Disclosure';

const meta = {
  component: Disclosure,
  parameters: { layout: 'padded' },
  args: {
    id: 'answer',
    question: 'How do I return to my room?',
    children: <p className="mb-4">Open your room in the same browser.</p>,
  },
} satisfies Meta<typeof Disclosure>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Open: Story = { args: { open: true } };
