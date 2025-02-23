// main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './components/App';
import { UndoRedoProvider } from './context/UndoRedoContext';

document.body.style.margin = '0';
document.body.style.padding = '0';
document.body.style.height = '100%';
document.body.style.boxSizing = 'border-box';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <UndoRedoProvider>
      <App />
    </UndoRedoProvider>
  </React.StrictMode>
);
