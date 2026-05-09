import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: {
      index: 'src/index.ts',
      'core/index': 'src/core/index.ts',
      'schemas/index': 'src/schemas/index.ts',
      'react/index': 'src/react/index.tsx',
    },
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    outDir: 'dist',
    shims: false,
    treeshake: true,
  },
  {
    entry: {
      'cli/changelog': 'src/cli/changelog.ts',
    },
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: false,
    outDir: 'dist',
    banner: {
      js: '#!/usr/bin/env node',
    },
    shims: false,
    treeshake: true,
  },
])
