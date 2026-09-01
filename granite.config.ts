import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'nuganellae',
  brand: {
    displayName: 'nuganellae',
    primaryColor: '#3182F6',
    // Replace this with the icon URL copied from AppsInToss Console app info.
    icon: 'https://static.toss.im/appsintoss/59837/7dbf9e96-2d88-4747-a6b5-928a1a698f57.png',
  },
  web: {
    host: '10.250.99.106',
    port: 5173,
    commands: {
      dev: 'vite dev',
      build: 'vite build --outDir dist/web',
    },
  },
  permissions: [{ name: 'clipboard', access: 'write' }],
  outdir: 'dist',
  webViewProps: {
    type: 'partner',
  },
});
