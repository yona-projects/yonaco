import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
  label: 'integration',
  files: 'out/test/suite/**/*.test.js',
  version: 'stable',
  mocha: {
    ui: 'bdd',
    timeout: 20000,
  },
});
