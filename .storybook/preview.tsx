import type { Preview } from '@storybook/nextjs-vite';
import { mswLoader } from 'msw-storybook-addon/csf3';
import '../app/globals.css';
import { Header } from '../components/Header/Header';
import { SprigDecoration } from '../components/SprigDecoration/SprigDecoration';
import { mswHandlers } from './msw-handlers';

const preview: Preview = {
  decorators: [
    (Story, context) =>
      context.parameters.appLayout ? (
        // Storybook owns the document; only reproduce the layout's visible content.
        <div className="relative isolate min-h-screen overflow-clip">
          <Header />
          <SprigDecoration />
          <Story />
        </div>
      ) : (
        <Story />
      ),
  ],
  loaders: [mswLoader()],
  async beforeEach({ msw }) {
    msw.use(...mswHandlers);
  },
  parameters: {
    layout: 'fullscreen',
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: 'error',
    },
  },
};

export default preview;
