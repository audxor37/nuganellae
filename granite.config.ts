import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'nuganellae',
  brand: {
    displayName: '누가낼래',
    primaryColor: '#3182F6',
    // Replace this with the icon URL copied from AppsInToss Console app info.
    icon: 'https://static.toss.im/appsintoss/59837/7dbf9e96-2d88-4747-a6b5-928a1a698f57.png',
  },
  web: {
    host: 'localhost',
    port: 5173,
    commands: {
      dev: 'vite dev',
      build: 'vite build',
    },
  },
  permissions: [{ name: 'clipboard', access: 'write' }],
  outdir: 'dist',
  webViewProps: {
    type: 'partner',
  },
});
