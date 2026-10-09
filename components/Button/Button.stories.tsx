import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Button } from './Button';

type Story = StoryObj<typeof meta>;

const meta = {
  component: Button,
  parameters: { layout: 'padded' },
  args: { children: 'Create room', disabled: false },
} satisfies Meta<typeof Button>;

export default meta;

export const Default: Story = {};

export const Secondary: Story = {
  args: { variant: 'secondary', children: 'Copy' },
};

export const Text: Story = {
  args: { variant: 'text', children: 'Start over' },
};

export const Disabled: Story = { args: { disabled: true } };
