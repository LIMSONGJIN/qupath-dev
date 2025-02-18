# React + TypeScript + Vite

이 템플릿은 Vite에서 React를 HMR과 함께 최소한의 설정으로 동작하도록 구성된 환경을 제공합니다.

## 환경 설정

이 프로젝트는 **Node.js v22.13.0** 환경에서 동작합니다. 먼저, 해당 버전이 설치되어 있는지 확인하세요.

```sh
node -v  # v22.13.0 확인
```

## 설치 및 실행 방법

1. GitHub에서 프로젝트를 클론합니다.

   ```sh
   git clone <repository-url>
   cd <project-directory>
   ```

2. 패키지를 설치합니다.

   ```sh
   npm install
   ```

3. 프로젝트를 실행합니다.

   ```sh
   npm run start
   ```

## 공식 플러그인

현재 두 개의 공식 플러그인이 제공됩니다:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md): [Babel](https://babeljs.io/)을 사용하여 Fast Refresh 지원
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc): [SWC](https://swc.rs/)를 사용하여 Fast Refresh 지원

## ESLint 설정 확장하기

프로덕션 애플리케이션을 개발하는 경우, TypeScript 타입 검사 기능이 활성화된 ESLint 설정을 권장합니다.

1. `parserOptions` 속성을 다음과 같이 설정합니다:

   ```js
   export default tseslint.config({
     languageOptions: {
       // other options...
       parserOptions: {
         project: ['./tsconfig.node.json', './tsconfig.app.json'],
         tsconfigRootDir: import.meta.dirname,
       },
     },
   });
   ```

2. `tseslint.configs.recommended`를 `tseslint.configs.recommendedTypeChecked` 또는 `tseslint.configs.strictTypeChecked`로 변경합니다.
3. 선택적으로 `...tseslint.configs.stylisticTypeChecked`를 추가할 수 있습니다.
4. [eslint-plugin-react](https://github.com/jsx-eslint/eslint-plugin-react)를 설치하고 다음과 같이 설정합니다:

   ```js
   // eslint.config.js
   import react from 'eslint-plugin-react';

   export default tseslint.config({
     // React 버전 설정
     settings: { react: { version: '18.3' } },
     plugins: {
       // React 플러그인 추가
       react,
     },
     rules: {
       // 기타 규칙 추가
       ...react.configs.recommended.rules,
       ...react.configs['jsx-runtime'].rules,
     },
   });
   ```
