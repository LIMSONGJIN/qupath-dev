import { useCallback, useEffect, useState } from 'react';
import { Annotation, ImageInfo } from '../types/app';
import ClassManager from './ClassManager';
import ImageList from './ImageList';
import ImageViewer from './ImageViewer';

function App() {
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [selectedImageName, setSelectedImageName] = useState<string>('이미지를 선택하세요');
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);

  // 이미지 선택 이벤트 핸들러
  const handleImageSelect = (image: string, name: string) => {
    setSelectedImage(image);
    setSelectedImageName(name);
    // 선택한 이미지 정보를 로컬 스토리지에 저장
    localStorage.setItem('selectedImage', image);
    localStorage.setItem('selectedImageName', name);

    fetch(`/annotations/${name.split('.')[0]}_annotation.json`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load annotations (status: ${response.status})`);
        }
        return response.json();
      })
      .then((data) => {
        setAnnotations(data.annotations || []);
      })
      .catch((error) => {
        console.error('Error loading annotations:', error);
        setAnnotations([]);
      });
  };

  const handleKeyPress = useCallback(
    (e: KeyboardEvent) => {
      if (images.length === 0) return;

      const currentIndex = images.findIndex((img) => img.url === selectedImage);
      if (currentIndex === -1) return;

      if (e.key.toLowerCase() === 'z') {
        const prevIndex = (currentIndex === 0 ? images.length : currentIndex) - 1;
        handleImageSelect(images[prevIndex].url, images[prevIndex].name);
      } else if (e.key.toLowerCase() === 'x') {
        const nextIndex = (currentIndex + 1) % images.length;
        handleImageSelect(images[nextIndex].url, images[nextIndex].name);
      }
    },
    [selectedImage, images]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '10px',
          backgroundColor: '#f8f9fa',
          borderBottom: '1px solid #ddd',
          textAlign: 'center',
        }}
      >
        <h3 style={{ margin: 0 }}>{selectedImageName}</h3>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div
          style={{
            width: '200px',
            backgroundColor: '#f4f4f4',
            borderRight: '1px solid #ccc',
            overflowY: 'auto',
            padding: '10px',
          }}
        >
          <ImageList
            onImageSelect={handleImageSelect}
            selectedImage={selectedImage}
            setImages={setImages}
          />
        </div>

        <div style={{ flex: 2, backgroundColor: '#000', position: 'relative', overflow: 'hidden' }}>
          {selectedImage ? (
            <ImageViewer
              imageUrl={selectedImage}
              annotations={annotations}
              setAnnotations={setAnnotations}
            />
          ) : (
            <div style={{ color: 'white', textAlign: 'center', marginTop: '20px' }}>
              이미지를 선택하세요
            </div>
          )}
        </div>

        <div
          style={{
            width: '250px',
            backgroundColor: '#f8f9fa',
            borderLeft: '1px solid #ccc',
            padding: '10px',
            overflowY: 'auto',
          }}
        >
          <ClassManager selectedImageName={selectedImageName} />
        </div>
      </div>
    </div>
  );
}

export default App;
