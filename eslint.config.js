import prettier from 'eslint-config-prettier';
import react from 'eslint-plugin-react';
import tseslint from 'typescript-eslint';

export default tseslint.config({
  languageOptions: {
    parserOptions: {
      project: ['./tsconfig.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
  plugins: {
    react,
  },
  rules: {
    ...react.configs.recommended.rules,
    ...react.configs['jsx-runtime'].rules,
    ...prettier.rules, // Prettier 설정 추가
  },
});
