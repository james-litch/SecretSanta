import type { Preview } from '@storybook/nextjs-vite'
import { Geist, Geist_Mono } from 'next/font/google'
import { mswLoader } from 'msw-storybook-addon/csf3'
import { INITIAL_VIEWPORTS } from 'storybook/viewport'
import '../app/globals.css'
import { mswHandlers } from './msw-handlers'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

const preview: Preview = {
  decorators: [
    (Story) => (
      <div className={`${geistSans.variable} ${geistMono.variable} min-h-screen flex flex-col antialiased`}>
        <Story />
      </div>
    ),
  ],
  loaders: [mswLoader()],
  async beforeEach({ msw }) {
    msw.use(...mswHandlers)
  },
  parameters: {
    layout: 'fullscreen',
    viewport: { options: INITIAL_VIEWPORTS },
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
      test: 'todo'
    }
  },
};

export default preview;
