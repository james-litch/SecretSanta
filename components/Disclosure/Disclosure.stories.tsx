import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect } from 'storybook/test';
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

export const ConsistentQuestionStyle: Story = {
  play: async ({ canvasElement, userEvent }) => {
    const summary = canvasElement.querySelector('summary')!;
    const details = canvasElement.querySelector('details')!;
    const typography = () => {
      const style = getComputedStyle(summary);
      return [style.fontFamily, style.fontSize, style.fontWeight];
    };
    const closedType = typography();
    await expect(closedType).toEqual(['Arial, sans-serif', '16px', '400']);
    await userEvent.click(summary);
    await expect(details).toHaveAttribute('open');
    await expect(typography()).toEqual(closedType);
    await userEvent.click(summary);
    await expect(details).not.toHaveAttribute('open');
    await expect(typography()).toEqual(closedType);
  },
};
