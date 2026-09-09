import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'nuganellae',
  brand: {
    displayName: '누가낼래?',
    primaryColor: '#3182F6',
    // Replace this with the icon URL copied from AppsInToss Console app info.
    icon: 'https://static.toss.im/appsintoss/59837/403e457f-5d60-4f8b-a6cc-4550c4c53a6e.png',
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
