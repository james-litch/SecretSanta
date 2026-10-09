import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { RoomCodeShareCard } from './RoomCodeShareCard';

const meta = {
  component: RoomCodeShareCard,
  parameters: { layout: 'padded' },
  args: { code: 'ABCDEF0123456789ABCDEF01' },
} satisfies Meta<typeof RoomCodeShareCard>;
export default meta;

type Story = StoryObj<typeof meta>;
export const Default: Story = {};
