import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FormField } from './FormField';

const meta = {
  component: FormField,
  parameters: { layout: 'padded' },
  args: {
    id: 'name',
    label: 'Your name',
    hint: 'The name your group will see.',
  },
} satisfies Meta<typeof FormField>;
export default meta;

type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Invalid: Story = {
  args: { error: 'Enter a name between 1 and 40 characters.' },
};
export const ReadOnly: Story = { args: { readOnly: true, value: 'James' } };
