import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { RoomCodeShareCard } from './RoomCodeShareCard';

const meta = {
  component: RoomCodeShareCard,
  parameters: { layout: 'padded' },
  args: { code: 'ABCDEF0123456789ABCDEF01' },
} satisfies Meta<typeof RoomCodeShareCard>;
export default meta;

type Story = StoryObj<typeof meta>;
export const Default: Story = {};

export const CopySuccess: Story = {
  beforeEach: () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: fn().mockResolvedValue(undefined) },
    });
    return () => {
      if (original) Object.defineProperty(navigator, 'clipboard', original);
      else Reflect.deleteProperty(navigator, 'clipboard');
    };
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Copy' }));
    await expect(navigator.clipboard.writeText).toHaveBeenCalledWith(args.code);
    await expect(canvas.getByRole('status')).toHaveTextContent(
      'Room code copied.',
    );
  },
};
export const CopyFailure: Story = {
  beforeEach: () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: fn().mockRejectedValue(new Error('denied')) },
    });
    return () => {
      if (original) Object.defineProperty(navigator, 'clipboard', original);
      else Reflect.deleteProperty(navigator, 'clipboard');
    };
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Copy' }));
    await expect(canvas.getByRole('status')).toHaveTextContent(
      'Select and copy the room code above.',
    );
    await expect(canvas.getByLabelText('Room code')).toHaveTextContent(
      args.code,
    );
  },
};
