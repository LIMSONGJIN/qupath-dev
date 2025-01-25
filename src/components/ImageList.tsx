import React from "react";

function ImageList() {
  const images = ["image_1.png", "image_2.png"]; // 샘플 데이터
  const handleImageClick = (image: string) => {
    console.log("Selected Image:", image);
  };

  return (
    <div className="image-list">
      {images.map((image, index) => (
        <div key={index} onClick={() => handleImageClick(image)}>
          {image}
        </div>
      ))}
    </div>
  );
}

export default ImageList;
