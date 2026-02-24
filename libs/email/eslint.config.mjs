import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['**/*.ts'],
    rules: {
      // Server-side code legitimately uses setTimeout, setInterval, etc.
      'local/no-direct-browser-apis': 'off',
    },
  },
  {
    files: ['src/lib/components/**/*.ts'],
    rules: {
      // Email components use Angular JIT rendering which doesn't support signal inputs.
      // @Input() decorators are required here.
      'local/no-legacy-angular-decorators': 'off',
    },
  },
  {
    files: ['**/*.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          ignoredFiles: [
            '{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}',
            '{projectRoot}/esbuild.config.{js,ts,mjs,mts}',
            '{projectRoot}/vitest.config.{js,ts,mjs,mts}',
          ],
        },
      ],
    },
    languageOptions: {
      parser: await import('jsonc-eslint-parser'),
    },
  },
];
