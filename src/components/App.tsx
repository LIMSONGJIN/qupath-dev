import React, { useState } from "react";
import ImageList from "./ImageList";
import ImageViewer from "./ImageViewer";
import Toolbar from "./Toolbar";

function App() {
  const [selectedImage, setSelectedImage] = useState<string>("/images/1.png");

  const handleImageSelect = (image: string) => {
    setSelectedImage(image);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", width: "100vw",overflow: "hidden",}}>
      {/* 툴바 영역 */}
      {/* <Toolbar /> */}

      {/* 메인 레이아웃 (좌-우 정렬) */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* 좌측 이미지 리스트 */}
        <div
          style={{
            width: "300px",
            backgroundColor: "#f4f4f4",
            borderRight: "1px solid #ccc",
            overflowY: "auto",
            padding: "10px",
          }}
        >
          <ImageList onImageSelect={handleImageSelect} />
        </div>

        {/* 우측 이미지 뷰어 */}
        <div style={{ flex: 1, backgroundColor: "#000", position: "relative", overflow: "hidden" }}>
          <ImageViewer imageUrl={selectedImage} />
        </div>
      </div>
    </div>
  );
}

export default App;
