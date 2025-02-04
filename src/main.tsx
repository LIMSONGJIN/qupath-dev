import React from "react";
import ReactDOM from "react-dom/client";
import App from "./components/App"; // App 컴포넌트를 가져옵니다.

document.body.style.margin = '0';
document.body.style.padding = '0';
document.body.style.height = '100%';
document.body.style.boxSizing = 'border-box';

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
