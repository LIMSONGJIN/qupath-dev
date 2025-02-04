import React from "react";

interface ImageListProps {
  onImageSelect: (image: string) => void;
}

const ImageList: React.FC<ImageListProps> = ({ onImageSelect }) => {
  const images = ["/images/1.png", "/images/2.png", "/images/3.png"]; // 샘플 데이터

  return (
    <div className="image-list">
      {images.map((image, index) => (
        <div key={index} onClick={() => onImageSelect(image)}>
          {image}
        </div>
      ))}
    </div>
  );
};

export default ImageList;
