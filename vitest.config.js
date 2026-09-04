import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Limita concorrência para evitar saturação do thread pool do bcrypt (native),
    // que pode causar falhas intermitentes em login/seed quando muitos arquivos rodam em paralelo.
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: 3,
        minForks: 1
      }
    },
    fileParallelism: true,
    isolate: true,
    setupFiles: []
  }
});
