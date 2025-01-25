import React from "react";

function Toolbar() {
  const handleOpenFolder = () => {
    // 이미지 폴더 선택 로직
    console.log("Open Folder");
  };

  const handleSave = () => {
    // 데이터 저장 로직
    console.log("Save Annotations");
  };

  return (
    <div className="toolbar">
      <button onClick={handleOpenFolder}>Open Folder</button>
      <button onClick={handleSave}>Save</button>
    </div>
  );
}

export default Toolbar;
