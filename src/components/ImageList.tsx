import React, { useEffect, useRef, useState } from "react";

interface ImageListProps {
  onImageSelect: (image: string, name: string) => void;
  selectedImage: string;
  setImages: (images: ImageInfo[]) => void;  // 이미지 리스트 상태 전달
}

interface ImageInfo {
  url: string;
  name: string;
  width: number;
  height: number;
}

const ImageList: React.FC<ImageListProps> = ({ onImageSelect, selectedImage, setImages }) => {
  const [images, setLocalImages] = useState<ImageInfo[]>([]);
  const selectedImageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const loadImages = async () => {
      const imageModules = import.meta.glob("/public/images/*.png", { eager: true, as: "url" });

      const imageUrls = Object.entries(imageModules).map(([path, url]) => {
        const name = path.split("/").pop() || "Unknown";
        return { url: url as string, name };
      });

      imageUrls.sort((a, b) => parseInt(a.name.split(".")[0], 10) - parseInt(b.name.split(".")[0], 10));

      const imageInfoPromises = imageUrls.map(async (image) => {
        const img = new Image();
        img.src = image.url;
        await img.decode();
        return { ...image, width: img.naturalWidth, height: img.naturalHeight };
      });

      const imageInfoList = await Promise.all(imageInfoPromises);
      setLocalImages(imageInfoList);
      setImages(imageInfoList);  // 부모 컴포넌트에 이미지 리스트 전달

      const savedImage = localStorage.getItem("selectedImage");
      const savedImageName = localStorage.getItem("selectedImageName");

      if (savedImage && savedImageName) {
        onImageSelect(savedImage, savedImageName);
      } else if (imageInfoList.length > 0) {
        onImageSelect(imageInfoList[0].url, imageInfoList[0].name);
      }
    };

    loadImages();
  }, [onImageSelect, setImages]);

  useEffect(() => {
    if (selectedImageRef.current) {
      selectedImageRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [selectedImage]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", padding: "10px", overflowY: "auto", height: "100%" }}>
      {images.map((image, index) => (
        <div
          key={index}
          ref={selectedImage === image.url ? selectedImageRef : null}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "10px",
            border: selectedImage === image.url ? "3px solid #007bff" : "none",
            borderRadius: "8px",
            padding: "5px",
            boxShadow: selectedImage === image.url ? "0 0 10px rgba(0, 123, 255, 0.5)" : "none",
            backgroundColor: selectedImage === image.url ? "#e9f5ff" : "transparent",
          }}
        >
          <button
            onClick={() => onImageSelect(image.url, image.name)}
            style={{ border: "none", padding: 0, backgroundColor: "transparent", width: "100%" }}
          >
            <img
              src={image.url}
              alt={image.name}
              style={{
                width: "100%",
                height: "300px",
                objectFit: "cover",
                borderRadius: "8px",
              }}
            />
          </button>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: "16px", fontWeight: "bold", margin: "5px 0" }}>{image.name}</p>
            <p style={{ fontSize: "14px", color: "#555" }}>
              {image.width} x {image.height} px
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ImageList;
