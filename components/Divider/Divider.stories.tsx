import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Divider } from './Divider';

const meta = {
  component: Divider,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Divider>;
export default meta;

type Story = StoryObj<typeof meta>;
export const Default: Story = {};
