import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  webExt: {
    disabled: true,
  },
  manifest: {
    name: 'DSA Partner',
    description: 'Your teacher-like coach for LeetCode problems',
    permissions: ['storage'],
    host_permissions: [
      'https://generativelanguage.googleapis.com/*',
      'https://api.groq.com/*',
    ],
  },
});