import { useCallback, useEffect, useMemo, useState } from 'react';
import { Annotation, ImageInfo } from '../types/app';
import { ClassInfo } from '../types/classmanager';
import ClassManager from './ClassManager';
import ImageList from './ImageList';
import ImageViewer from './ImageViewer';

function App() {
  // 이미지 관련 상태
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [selectedImageName, setSelectedImageName] = useState<string>('이미지를 선택하세요');

  // 어노테이션 상태와 저장 관리
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [initialAnnotations, setInitialAnnotations] = useState<Annotation[]>([]);
  const [annotationsUnsaved, setAnnotationsUnsaved] = useState<boolean>(false);

  // 클래스 상태와 저장 관리
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [initialClasses, setInitialClasses] = useState<ClassInfo[]>([]);
  const [classesUnsaved, setClassesUnsaved] = useState<boolean>(false);

  // ───────────────────────────────────────────────────────────────
  // (A) 이미지 전환 전 unsaved 변경사항 체크 & 실제 선택
  // ───────────────────────────────────────────────────────────────
  const handleImageSelect = useCallback(
    (image: string, name: string) => {
      // 가드: 이미 선택된 이미지라면 아무 작업도 하지 않음
      if (image === selectedImage) {
        console.log('handleImageSelect: 같은 이미지를 다시 선택하려고 함 → 무시');
        return;
      }
      // unsaved가 true라면 저장 여부 묻기
      if ((annotationsUnsaved || classesUnsaved) && image !== selectedImage) {
        const confirmed = window.confirm(
          '저장되지 않은 변경사항이 있습니다. 저장하시겠습니까?\n(저장하지 않으면 마지막 저장 상태로 복원됩니다.)'
        );
        if (confirmed) {
          handleSave();
        } else {
          // 되돌리기
          setAnnotations(initialAnnotations);
          setClasses(initialClasses);
          setAnnotationsUnsaved(false);
          setClassesUnsaved(false);
        }
      }
      // 실제 이미지 전환
      setSelectedImage(image);
      setSelectedImageName(name);
      localStorage.setItem('selectedImage', image);
      localStorage.setItem('selectedImageName', name);
    },
    [
      selectedImage,
      annotationsUnsaved,
      classesUnsaved,
      annotations,
      classes,
      initialAnnotations,
      initialClasses,
    ]
  );

  // ───────────────────────────────────────────────────────────────
  // (B) 이미지 목록 불러오기 (목록 로드 & state 업데이트 전담)
  // ───────────────────────────────────────────────────────────────
  const loadImages = useCallback(async () => {
    try {
      const imageInfoList: ImageInfo[] = await window.api.reloadImages();
      setImages(imageInfoList);
      return imageInfoList; // 로드한 목록 반환
    } catch (err) {
      console.error('Error loading images:', err);
      return [];
    }
  }, []);

  // (B-1) 처음 마운트 시 한 번 로드하고 자동 선택 처리
  useEffect(() => {
    loadImages().then((newImages) => {
      if (newImages.length > 0 && !selectedImage) {
        const savedImage = localStorage.getItem('selectedImage');
        const savedImageName = localStorage.getItem('selectedImageName');
        if (savedImage && savedImageName) {
          handleImageSelect(savedImage, savedImageName);
        } else {
          handleImageSelect(newImages[0].url, newImages[0].name);
        }
      }
    });
  }, [loadImages, selectedImage, handleImageSelect]);

  // (B-2) 새 이미지 추가되면 다시 로드 → 방금 추가한 이미지 자동 선택
  useEffect(() => {
    const handleImageAdded = async (event: any, payload: { fileName: string }) => {
      console.log('[App] image-added event received:', payload.fileName);
      const newImages = await loadImages();
      const newlyAdded = newImages.find((img) => img.name === payload.fileName);
      if (newlyAdded) {
        handleImageSelect(newlyAdded.url, newlyAdded.name);
      }
    };

    window.api.onImageAdded(handleImageAdded);
    return () => {
      window.api.removeImageAddedListener(handleImageAdded);
    };
  }, [loadImages, handleImageSelect]);

  // ───────────────────────────────────────────────────────────────
  // (D) 어노테이션 & 클래스 저장
  // ───────────────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    if (!selectedImageName || selectedImageName === '이미지를 선택하세요') return;

    const baseName = selectedImageName.split('.')[0];
    const saveAnnotationsPromise = window.api.saveAnnotations(`${baseName}_annotation`, {
      annotations,
    });
    const updateClassesPromise = window.api.updateClasses(classes);

    Promise.all([saveAnnotationsPromise, updateClassesPromise])
      .then(([annoResult, classResult]) => {
        if (annoResult.success) {
          setInitialAnnotations(annotations);
          setAnnotationsUnsaved(false);
        }
        // @ts-ignore
        if (classResult.success) {
          setInitialClasses(classes);
          setClassesUnsaved(false);
        }
        // @ts-ignore
        if (annoResult.success && classResult.success) {
          window.alert('저장되었습니다.');
        }
      })
      .catch((error) => console.error('Error saving:', error));
  }, [selectedImageName, annotations, classes]);

  // ───────────────────────────────────────────────────────────────
  // (E) 이미지명 변경 시 어노테이션 로드
  // ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedImageName || selectedImageName === '이미지를 선택하세요') {
      setAnnotations([]);
      setInitialAnnotations([]);
      setAnnotationsUnsaved(false);
      return;
    }
    setAnnotations([]);

    const baseName = selectedImageName.split('.')[0];
    // @ts-ignore
    window.api
      .loadAnnotations(`${baseName}_annotation`)
      .then((data: { annotations: never[] }) => {
        const loaded = data.annotations || [];
        setAnnotations(loaded);
        setInitialAnnotations(loaded);
        setAnnotationsUnsaved(false);
      })
      .catch((error: any) => {
        console.error('Error loading annotations:', error);
        setAnnotations([]);
        setInitialAnnotations([]);
        setAnnotationsUnsaved(false);
      });
  }, [selectedImageName]);

  // ───────────────────────────────────────────────────────────────
  // (F) z, x 키로 이미지 전환
  // ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.ctrlKey) return; // Ctrl키가 있으면 스킵
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
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [images, selectedImage, handleImageSelect]);

  // ───────────────────────────────────────────────────────────────
  // (G) 클래스 정보 로드
  // ───────────────────────────────────────────────────────────────
  useEffect(() => {
    // @ts-ignore
    window.api.getClasses().then((response) => {
      if (response.success) {
        setClasses(response.classes);
        setInitialClasses(response.classes);
        setClassesUnsaved(false);
      }
    });
  }, []);

  // ───────────────────────────────────────────────────────────────
  // (H) Ctrl+S 단축키
  // ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  // ───────────────────────────────────────────────────────────────
  // (I) 창 리로드/종료 시 unsaved 변경사항 경고
  // ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (annotationsUnsaved || classesUnsaved) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [annotationsUnsaved, classesUnsaved]);

  const classCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    annotations.forEach((ann) => {
      const cls = ann.class || 'Unclassified';
      counts[cls] = (counts[cls] || 0) + 1;
    });
    return counts;
  }, [annotations]);

  // ───────────────────────────────────────────────────────────────
  // (J) 렌더링
  // ───────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* 상단 헤더 */}
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

      {/* 메인 레이아웃 */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* 왼쪽: 이미지 리스트 */}
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
            images={images}
            onImageSelect={handleImageSelect}
            selectedImage={selectedImage}
          />
        </div>

        {/* 중앙: 이미지 뷰어 */}
        <div style={{ flex: 2, backgroundColor: '#000', position: 'relative', overflow: 'hidden' }}>
          {selectedImage ? (
            <ImageViewer
              imageUrl={selectedImage}
              annotations={annotations}
              setAnnotations={setAnnotations}
              classes={classes}
              setAnnotationsUnsaved={setAnnotationsUnsaved}
            />
          ) : (
            <div style={{ color: 'white', textAlign: 'center', marginTop: '20px' }}>
              이미지를 선택하세요
            </div>
          )}
        </div>

        {/* 오른쪽: 클래스 관리 */}
        <div
          style={{
            width: '250px',
            backgroundColor: '#f8f9fa',
            borderLeft: '1px solid #ccc',
            padding: '10px',
            overflowY: 'auto',
          }}
        >
          <ClassManager
            classes={classes}
            setClasses={setClasses}
            setClassesUnsaved={setClassesUnsaved}
            classCounts={classCounts}
            setAnnotations={setAnnotations}
            setAnnotationsUnsaved={setAnnotationsUnsaved}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
