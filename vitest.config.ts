import { resolve } from 'node:path'
import { defineConfig, defineProject } from 'vitest/config'

const alias = {
  '@renderer': resolve('src/renderer/src'),
  '@main': resolve('src/main'),
  '@shared': resolve('src/shared')
}

export default defineConfig({
  resolve: {
    alias
  },
  test: {
    projects: [
      defineProject({
        resolve: {
          alias
        },
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/**/*.test.ts']
        }
      }),
      defineProject({
        resolve: {
          alias
        },
        test: {
          name: 'renderer',
          environment: 'jsdom',
          include: ['src/renderer/src/**/*.test.tsx'],
          setupFiles: ['src/test/setup.ts']
        }
      })
    ]
  }
})
