import { defineConfig } from 'oxfmt'

export default defineConfig({
  ignorePatterns: ['dist/**', 'node_modules/**'],
  printWidth: 100,
  semi: false,
  singleQuote: true,
  sortImports: {
    newlinesBetween: true,
  },
  sortPackageJson: {
    sortScripts: true,
  },
  sortTailwindcss: true,
})
