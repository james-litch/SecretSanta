import type { StorybookConfig } from '@storybook/nextjs-vite';
import tailwindcss from '@tailwindcss/vite';
import svgr from 'vite-plugin-svgr';

const config: StorybookConfig = {
  stories: [
    '../app/**/*.stories.@(js|jsx|mjs|ts|tsx)',
    '../components/**/*.stories.@(js|jsx|mjs|ts|tsx)',
  ],
  addons: [
    '@chromatic-com/storybook',
    '@storybook/addon-vitest',
    '@storybook/addon-a11y',
    '@storybook/addon-docs',
    '@storybook/addon-mcp',
    'msw-storybook-addon',
  ],
  framework: {
    name: '@storybook/nextjs-vite',
    options: {
      image: { excludeFiles: ['**/*.svg'] },
    },
  },
  async viteFinal(config) {
    config.plugins = [
      ...(config.plugins ?? []),
      tailwindcss(),
      // Match the application's default SVG component imports.
      svgr({ include: '**/*.svg' }),
    ];
    return config;
  },
  staticDirs: ['../public'],
};
export default config;
