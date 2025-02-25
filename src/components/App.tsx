// App.tsx
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

  // 1) 이미지 선택 시 상태 업데이트
  const handleImageSelect = (image: string, name: string) => {
    setSelectedImage(image);
    setSelectedImageName(name);

    localStorage.setItem('selectedImage', image);
    localStorage.setItem('selectedImageName', name);
  };

  // 2) selectedImageName이 바뀔 때 어노테이션 로드
  useEffect(() => {
    if (!selectedImageName || selectedImageName === '이미지를 선택하세요') {
      setAnnotations([]);
      return;
    }
    // 확장자 제거 후 "_annotation" 붙여서 IPC로 로드
    const baseName = selectedImageName.split('.')[0];
    console.log('Loading annotations via window.api:', baseName);

    window.api
      .loadAnnotations(`${baseName}_annotation`)
      .then((data) => {
        console.log('Loaded annotations:', data);
        setAnnotations(data.annotations || []);
      })
      .catch((error) => {
        console.error('Error loading annotations:', error);
        setAnnotations([]);
      });
  }, [selectedImageName]);

  // 3) 키보드로 이미지 전환 (z: 이전, x: 다음)
  const handleKeyPress = useCallback(
    (e: KeyboardEvent) => {
      // Ctrl 키가 눌린 경우엔 이미지 전환 스킵
      if (e.ctrlKey) return;

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
        {/* 사이드바: 이미지 리스트 */}
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

        {/* 중앙: 이미지 뷰어 */}
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

        {/* 우측: 클래스 관리 */}
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
