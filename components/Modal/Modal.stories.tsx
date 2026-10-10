import { Button } from '@/components/Button/Button';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, within, waitFor } from 'storybook/test';
import { Modal } from './Modal';

const meta = {
  component: Modal,
  args: { id: 'example-modal', title: 'A little gathering', closedby: 'any' },
  render: (args) => (
    <>
      <Button command="show-modal" commandFor={args.id}>
        Open modal
      </Button>
      <Modal {...args}>
        <p className="mb-6">Bring your group together for a lovely surprise.</p>
        <Button command="close" commandFor={args.id}>
          Cancel
        </Button>
      </Modal>
    </>
  ),
} satisfies Meta<typeof Modal>;
export default meta;

type Story = StoryObj<typeof meta>;
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'Open modal' });
    await userEvent.click(trigger);
    const modal = canvas.getByRole('dialog');
    await waitFor(() => expect(modal).toBeVisible());
    await expect(
      within(modal).getByRole('button', { name: 'Close modal' }),
    ).toHaveFocus();
    await userEvent.click(
      within(modal).getByRole('button', { name: 'Close modal' }),
    );
    await waitFor(() => expect(modal).not.toBeVisible());
    await waitFor(() => expect(trigger).toHaveFocus());
    await userEvent.click(trigger);
  },
};
