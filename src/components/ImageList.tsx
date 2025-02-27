import React, { useEffect, useRef } from 'react';
import { ImageInfo } from '../types/app';

interface ImageListProps {
  images: ImageInfo[];
  onImageSelect: (url: string, name: string) => void;
  selectedImage: string;
}

const ImageList: React.FC<ImageListProps> = ({ images, onImageSelect, selectedImage }) => {
  const selectedImageRef = useRef<HTMLDivElement | null>(null);

  // 선택된 이미지로 스크롤
  useEffect(() => {
    if (selectedImageRef.current) {
      selectedImageRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [selectedImage]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        padding: '10px',
        overflowY: 'auto',
        height: '100%',
      }}
    >
      {images.map((image, index) => (
        <div
          key={index}
          ref={selectedImage === image.url ? selectedImageRef : null}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '10px',
            border: selectedImage === image.url ? '3px solid #007bff' : 'none',
            borderRadius: '8px',
            padding: '5px',
            boxShadow: selectedImage === image.url ? '0 0 10px rgba(0, 123, 255, 0.5)' : 'none',
            backgroundColor: selectedImage === image.url ? '#e9f5ff' : 'transparent',
          }}
        >
          <button
            onClick={() => onImageSelect(image.url, image.name)}
            style={{
              border: 'none',
              padding: 0,
              backgroundColor: 'transparent',
              width: '100%',
            }}
          >
            <img
              src={image.url}
              alt={image.name}
              style={{
                width: '100%',
                height: '100px',
                objectFit: 'cover',
                borderRadius: '8px',
              }}
            />
          </button>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '12px', fontWeight: 'bold', margin: '5px 0' }}>{image.name}</p>
            <p style={{ fontSize: '14px', color: '#555' }}>
              {image.width} x {image.height} px
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ImageList;
