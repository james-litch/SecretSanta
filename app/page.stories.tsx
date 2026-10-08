import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect } from 'storybook/test';
import Home from './page';

const meta = {
  tags: ['ai-generated'],
  component: Home,
} satisfies Meta<typeof Home>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    const documentation = canvas.getByRole('link', { name: 'Documentation' });
    await expect(documentation).toHaveAttribute(
      'href',
      'https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app',
    );
    await expect(documentation).toHaveAttribute('target', '_blank');
    await expect(documentation).toHaveAttribute('rel', 'noopener noreferrer');
  },
};

export const Mobile: Story = {
  globals: { viewport: { value: 'mobile1', isRotated: false } },
};

export const CssCheck: Story = {
  play: async ({ canvas }) => {
    // Home's main uses flex-col, max-w-3xl (48rem), and py-32 (8rem).
    // These computed values require the shared Tailwind stylesheet to compile.
    const styles = getComputedStyle(canvas.getByRole('main'));
    await expect(styles.display).toBe('flex');
    await expect(styles.flexDirection).toBe('column');
    await expect(styles.maxWidth).toBe('768px');
    await expect(styles.paddingTop).toBe('128px');
  },
};
