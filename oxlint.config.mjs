import { defineConfig } from 'oxlint'

export default defineConfig({
  ignorePatterns: ['dist/**', 'node_modules/**'],
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
})
