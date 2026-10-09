import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { SprigDecoration } from './SprigDecoration';

const meta = {
  component: SprigDecoration,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="relative isolate min-h-64">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SprigDecoration>;
export default meta;

type Story = StoryObj<typeof meta>;
export const Default: Story = {};
