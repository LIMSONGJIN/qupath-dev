import React from "react";
import ImageList from "./ImageList";
import ImageViewer from "./ImageViewer";
import ClassManager from "./ClassManager";
import Toolbar from "./Toolbar";

function App() {
  return (
    <div className="app-container">
      <Toolbar />
      <div className="main-layout">
        <ImageList />
        <ImageViewer />
      </div>
      <ClassManager />
    </div>
  );
}

export default App;
