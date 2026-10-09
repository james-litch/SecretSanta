import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import FAQ from './page';
const meta = {
  title: 'Pages/FAQ',
  parameters: { appLayout: true },
  component: FAQ,
} satisfies Meta<typeof FAQ>;
export default meta;

type Story = StoryObj<typeof meta>;
export const Questions: Story = {};
