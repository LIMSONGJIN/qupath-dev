import OpenSeadragon from 'openseadragon';
import React, { useEffect, useRef, useState } from 'react';
import { Annotation, AnnotationRendererProps, CustomOSDEvent } from '../types/annotationrenderer';

const classColors: Record<string, string> = {
  Unclassified: '#FF0000',
  'Class 1': '#0072B2',
  'Class 2': '#56B4E9',
  'Class 3': '#90EE90',
  'Class 4': '#009E73',
  'Class 5': '#E69F00',
  'Class 6': '#D55E00',
  'Class 7': '#CC79A7',
  'Class 8': '#4B0082',
  'Class 9': '#CCCCCC',
};

const AnnotationRenderer: React.FC<AnnotationRendererProps> = ({
  annotations,
  setAnnotations,
  viewer,
  selectedAnnotations,
  setSelectedAnnotations,
  selectedSide,
  setSelectedSide,
  imageFileName,
}) => {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  if (overlayRef.current) {
    viewer.addOverlay({
      element: overlayRef.current as HTMLElement,
      location: new OpenSeadragon.Rect(0, 0, 1, 1),
    });
  }
  const [lastImageFile, setLastImageFile] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [classColors, setClassColors] = useState<Record<string, string>>({});
  const [classVisibility, setClassVisibility] = useState<Record<string, boolean>>({});
  const [showOnlyUnclassified, setShowOnlyUnclassified] = useState(false);

  // 초기화: 모든 클래스를 기본적으로 표시
  useEffect(() => {
    const fetchClassVisibility = async () => {
      const response = await window.api.getClasses();
      if (response.success) {
        const visibility = response.classes.reduce((acc, { name }) => {
          acc[name] = true; // 기본적으로 모두 표시
          return acc;
        }, {} as Record<string, boolean>);
        setClassVisibility(visibility);
      }
    };

    fetchClassVisibility();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'v' || event.key === 'V') {
        if (event.shiftKey) return; // Shift 키가 눌린 경우 무시

        if (event.ctrlKey || event.metaKey) {
          // ✅ V + 숫자키 (개별 클래스 토글)
          const classIndex = parseInt(event.key);
          if (!isNaN(classIndex) && classIndex >= 0 && classIndex <= 9) {
            const className = classIndex === 0 ? 'Unclassified' : `Class ${classIndex}`;
            setClassVisibility((prev) => ({
              ...prev,
              [className]: !prev[className], // 토글
            }));
          }
        } else {
          // ✅ 전체 토글
          const anyVisible = Object.values(classVisibility).some((v) => v);
          setClassVisibility((prev) =>
            Object.keys(prev).reduce((acc, key) => {
              acc[key] = !anyVisible;
              return acc;
            }, {} as Record<string, boolean>)
          );
        }
      }

      if (event.key === 'f' || event.key === 'F') {
        // ✅ `F`를 누르면 Unclassified만 보이도록 토글
        setShowOnlyUnclassified((prev) => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [classVisibility]);

  const fetchClassColors = async () => {
    const response = await window.api.getClasses();
    if (response.success) {
      const colors: Record<string, string> = {};
      response.classes.forEach(({ name, color }) => {
        colors[name] = color;
      });
      setClassColors(colors);
    }
  };

  useEffect(() => {
    fetchClassColors();

    // ✅ 클래스 변경 감지 이벤트 추가 (자동 반영)
    window.api.onClassesUpdated(fetchClassColors);

    return () => {
      window.api.onClassesUpdated(() => {}); // ✅ 이벤트 리스너 정리
    };
  }, []);

  const handleMouseDown = (event: CustomOSDEvent) => {
    const viewportPoint = viewer.viewport.pointFromPixel(event.position);
    const imagePoint = viewer.viewport.viewportToImageCoordinates(viewportPoint);

    let clickedAnnotation: Annotation | null = null;

    annotations.forEach((annotation) => {
      const [x, y, width, height] = annotation.bbox;
      if (
        imagePoint.x >= x &&
        imagePoint.x <= x + width &&
        imagePoint.y >= y &&
        imagePoint.y <= y + height
      ) {
        clickedAnnotation = annotation;
      }
    });

    if (clickedAnnotation && selectedAnnotations.includes(clickedAnnotation.id)) {
      setIsDragging(true);
      setDragStart(imagePoint);
      setDragOffset({
        x: imagePoint.x - clickedAnnotation.bbox[0],
        y: imagePoint.y - clickedAnnotation.bbox[1],
      });

      // ✅ OpenSeadragon Pan 기능 비활성화
      viewer.panVertical = false;
      viewer.panHorizontal = false;
      viewer.gestureSettingsMouse.flickEnabled = false;
    }
  };

  const handleMouseMove = (event: CustomOSDEvent) => {
    if (!isDragging || !dragStart || !dragOffset) return;

    const viewportPoint = viewer.viewport.pointFromPixel(event.position);
    const imagePoint = viewer.viewport.viewportToImageCoordinates(viewportPoint);

    setAnnotations((prevAnnotations) =>
      prevAnnotations.map((annotation) =>
        selectedAnnotations.includes(annotation.id)
          ? {
              ...annotation,
              bbox: [
                imagePoint.x - dragOffset.x, // 클릭한 위치 기준으로 이동
                imagePoint.y - dragOffset.y,
                annotation.bbox[2],
                annotation.bbox[3],
              ],
            }
          : annotation
      )
    );

    setDragStart(imagePoint);
  };

  const handleMouseUp = async () => {
    setIsDragging(false);
    setDragStart(null);
    setDragOffset(null);

    // ✅ OpenSeadragon Pan 기능 다시 활성화
    viewer.panVertical = true;
    viewer.panHorizontal = true;
    viewer.gestureSettingsMouse.flickEnabled = true;

    // ✅ 이동한 좌표 최신화 후 JSON 저장
    const updatedAnnotations = annotations.map((annotation) =>
      selectedAnnotations.includes(annotation.id)
        ? {
            ...annotation,
            bbox: [
              annotation.bbox[0], // 새로운 X 좌표
              annotation.bbox[1], // 새로운 Y 좌표
              annotation.bbox[2], // 너비 유지
              annotation.bbox[3], // 높이 유지
            ],
          }
        : annotation
    );

    try {
      const response = await window.api.saveAnnotations(`${imageFileName}_annotation`, {
        annotations: updatedAnnotations,
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to save updated annotations.');
      }
    } catch (error) {
      console.error('Error updating annotation positions:', error);
    }
  };
  useEffect(() => {
    if (!viewer) return;

    viewer.addHandler('canvas-press', handleMouseDown);
    viewer.addHandler('canvas-drag', handleMouseMove);
    viewer.addHandler('canvas-release', handleMouseUp);

    return () => {
      viewer.removeHandler('canvas-press', handleMouseDown);
      viewer.removeHandler('canvas-drag', handleMouseMove);
      viewer.removeHandler('canvas-release', handleMouseUp);
    };
  }, [viewer, annotations]);

  // alt키 제어
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey) {
        event.preventDefault();
        event.stopPropagation();
        document.body.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 여러 주석을 한 번에 삭제하는 함수로 변경
  const deleteSelectedAnnotations = async () => {
    if (!window.confirm('Are you sure you want to delete the selected annotations?')) return;

    const updatedAnnotations = annotations.filter(
      (annotation) => !selectedAnnotations.includes(annotation.id)
    );
    setAnnotations(updatedAnnotations);

    try {
      const response = await window.api.saveAnnotations(`${imageFileName}_annotation`, {
        annotations: updatedAnnotations,
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to save updated annotations.');
      }
      location.reload();
    } catch (error) {
      console.error('Error deleting annotations:', error);
    }

    // 선택 상태 초기화
    setSelectedAnnotations([]);
    setSelectedSide(null);
  };

  //
  useEffect(() => {
    const handleKeyDown = async (event: KeyboardEvent) => {
      const key = event.key;

      if (key === 'Delete' && selectedAnnotations.length > 0) {
        deleteSelectedAnnotations();
        return;
      }

      if (key >= '0' && key <= '9') {
        const newClass = key === '0' ? 'Unclassified' : `Class ${key}`;

        setAnnotations((prevAnnotations) =>
          prevAnnotations.map((annotation) =>
            selectedAnnotations.includes(annotation.id)
              ? { ...annotation, class: newClass }
              : annotation
          )
        );

        try {
          const response = await window.api.saveAnnotations(`${imageFileName}_annotation`, {
            annotations: annotations.map((annotation) =>
              selectedAnnotations.includes(annotation.id)
                ? { ...annotation, class: newClass }
                : annotation
            ),
          });

          if (!response.success) {
            throw new Error(response.error || 'Failed to save updated annotations.');
          }
        } catch (error) {
          console.error('Error updating annotation class:', error);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedAnnotations, annotations, imageFileName]);

  useEffect(() => {
    // 더블클릭(단일 선택)
    const handleCanvasDoubleClick = (event: CustomOSDEvent) => {
      const viewportPoint = viewer.viewport.pointFromPixel(event.position);
      const imagePoint = viewer.viewport.viewportToImageCoordinates(viewportPoint);

      let clickedAnnotationId: string | null = null;
      let clickedSide: string | null = null;
      const borderTolerance = 2;

      // 클릭된 주석 찾기
      annotations.forEach(({ id, bbox }) => {
        const [x, y, width, height] = bbox;

        if (
          imagePoint.x >= x - borderTolerance &&
          imagePoint.x <= x + width + borderTolerance &&
          imagePoint.y >= y - borderTolerance &&
          imagePoint.y <= y + height + borderTolerance
        ) {
          clickedAnnotationId = id;

          if (Math.abs(imagePoint.y - y) <= borderTolerance) clickedSide = 'top';
          else if (Math.abs(imagePoint.y - (y + height)) <= borderTolerance) clickedSide = 'bottom';
          else if (Math.abs(imagePoint.x - x) <= borderTolerance) clickedSide = 'left';
          else if (Math.abs(imagePoint.x - (x + width)) <= borderTolerance) clickedSide = 'right';
        }
      });

      if (clickedAnnotationId) {
        setSelectedAnnotations([clickedAnnotationId]); // 🔥 단일 선택만 허용
        setSelectedSide(clickedSide ? { id: clickedAnnotationId, side: clickedSide } : null);
      } else {
        // 선택 해제
        setSelectedAnnotations([]);
        setSelectedSide(null);
      }
    };

    // Alt + 클릭 (다중 선택)
    const handleCanvasClick = (event: CustomOSDEvent) => {
      if (!event.originalEvent.altKey) return; // Alt 키가 없으면 실행 안 함

      const viewportPoint = viewer.viewport.pointFromPixel(event.position);
      const imagePoint = viewer.viewport.viewportToImageCoordinates(viewportPoint);

      let clickedAnnotationId: string | null = null;
      const borderTolerance = 2;

      annotations.forEach(({ id, bbox }) => {
        const [x, y, width, height] = bbox;

        if (
          imagePoint.x >= x - borderTolerance &&
          imagePoint.x <= x + width + borderTolerance &&
          imagePoint.y >= y - borderTolerance &&
          imagePoint.y <= y + height + borderTolerance
        ) {
          clickedAnnotationId = id;
        }
      });

      if (clickedAnnotationId) {
        // @ts-ignore
        setSelectedAnnotations((prevSelected: string[]) => {
          if (prevSelected.includes(clickedAnnotationId!)) {
            return prevSelected.filter((id: string) => id !== clickedAnnotationId); // 🔥 `id`의 타입 명시
          } else {
            return [...prevSelected, clickedAnnotationId];
          }
        });
        setSelectedSide(null);
      }
    };

    viewer.addHandler('canvas-double-click', handleCanvasDoubleClick);
    viewer.addHandler('canvas-press', handleCanvasClick); // 🔥 Alt + 클릭 이벤트 추가

    return () => {
      viewer.removeHandler('canvas-double-click', handleCanvasDoubleClick);
      viewer.removeHandler('canvas-press', handleCanvasClick);
    };
  }, [
    annotations,
    selectedAnnotations,
    selectedSide,
    setSelectedAnnotations,
    setSelectedSide,
    viewer,
  ]);

  useEffect(() => {
    if (imageFileName !== lastImageFile) {
      if (annotations.length === 0 || !viewer) return;

      const viewportCenter = viewer.viewport.getCenter();
      const imageCenter = viewer.viewport.viewportToImageCoordinates(viewportCenter);

      let closestAnnotationId: string | null = null;
      let closestDistance = Infinity;

      annotations.forEach(({ id, bbox }) => {
        const [x, y, width, height] = bbox;
        const annotationCenterX = x + width / 2;
        const annotationCenterY = y + height / 2;

        const distance = Math.sqrt(
          (annotationCenterX - imageCenter.x) ** 2 + (annotationCenterY - imageCenter.y) ** 2
        );

        if (distance < closestDistance) {
          closestDistance = distance;
          closestAnnotationId = id;
        }
      });

      if (closestAnnotationId) {
        setSelectedAnnotations([closestAnnotationId]);
        setSelectedSide(null);
      }

      setLastImageFile(imageFileName);
    }
  }, [imageFileName, annotations, viewer]);

  useEffect(() => {
    const handleArrowKey = (event: KeyboardEvent) => {
      if (selectedAnnotations.length !== 1) return; // 🔥 하나의 annotation만 선택된 경우에만 동작

      const selectedId = selectedAnnotations[0]; // 선택된 annotation의 ID
      const selectedAnnotation = annotations.find((a) => a.id === selectedId);
      if (!selectedAnnotation) return; // 안전 체크

      let newSide: 'top' | 'bottom' | 'left' | 'right' | null = null;

      switch (event.key) {
        case 'ArrowUp':
          newSide = 'top';
          break;
        case 'ArrowDown':
          newSide = 'bottom';
          break;
        case 'ArrowLeft':
          newSide = 'left';
          break;
        case 'ArrowRight':
          newSide = 'right';
          break;
        default:
          return;
      }

      setSelectedSide({ id: selectedId, side: newSide });
    };

    document.addEventListener('keydown', handleArrowKey);
    return () => document.removeEventListener('keydown', handleArrowKey);
  }, [selectedAnnotations, annotations, setSelectedSide]);

  const updateAnnotationBbox = (key: string) => {
    if (!viewer) return;

    const tiledImage = viewer.world.getItemAt(0);
    if (!tiledImage) return;

    const { x: imageWidth, y: imageHeight } = tiledImage.getContentSize(); // ✅ 이미지 크기 가져오기
    const minSize = 1; // ✅ 최소 도형 크기
    // @ts-ignore
    setAnnotations((prevAnnotations: Annotation[]) => {
      const updatedAnnotations = prevAnnotations.map((annotation) => {
        if (annotation.id !== selectedSide?.id) return annotation;

        const [x, y, width, height] = annotation.bbox;
        let newX = x,
          newY = y,
          newWidth = width,
          newHeight = height;

        switch (selectedSide.side) {
          case 'top':
            if (key === 'ArrowUp' && newY > 0) {
              newY = Math.max(newY - 1, 0);
              newHeight = Math.min(newHeight + 1, imageHeight - newY);
            } else if (key === 'ArrowDown' && newHeight > minSize) {
              newY = Math.min(newY + 1, imageHeight - minSize);
              newHeight = Math.max(newHeight - 1, minSize);
            } else if (key === 'ArrowLeft' && newX > 0) {
              newX = Math.max(newX - 1, 0);
              newWidth = Math.min(newWidth + 1, imageWidth - newX);
            } else if (key === 'ArrowRight') {
              newWidth = Math.min(newWidth + 1, imageWidth - newX);
            }
            break;

          case 'bottom':
            if (key === 'ArrowUp' && newHeight > minSize) {
              newHeight = Math.max(newHeight - 1, minSize);
            } else if (key === 'ArrowDown') {
              newHeight = Math.min(newHeight + 1, imageHeight - newY);
            } else if (key === 'ArrowLeft' && newX > 0) {
              newX = Math.max(newX - 1, 0);
              newWidth = Math.min(newWidth + 1, imageWidth - newX);
            } else if (key === 'ArrowRight') {
              newWidth = Math.min(newWidth + 1, imageWidth - newX);
            }
            break;

          case 'left':
            if (key === 'ArrowUp' && newY > 0) {
              newY = Math.max(newY - 1, 0);
              newHeight = Math.min(newHeight + 1, imageHeight - newY);
            } else if (key === 'ArrowDown') {
              newHeight = Math.min(newHeight + 1, imageHeight - newY);
            } else if (key === 'ArrowLeft' && newX > 0) {
              newX = Math.max(newX - 1, 0);
              newWidth = Math.min(newWidth + 1, imageWidth - newX);
            } else if (key === 'ArrowRight' && newWidth > minSize) {
              newX = Math.min(newX + 1, imageWidth - minSize);
              newWidth = Math.max(newWidth - 1, minSize);
            }
            break;

          case 'right':
            if (key === 'ArrowUp' && newY > 0) {
              newY = Math.max(newY - 1, 0);
              newHeight = Math.min(newHeight + 1, imageHeight - newY);
            } else if (key === 'ArrowDown') {
              newHeight = Math.min(newHeight + 1, imageHeight - newY);
            } else if (key === 'ArrowLeft' && newWidth > minSize) {
              newWidth = Math.max(newWidth - 1, minSize);
            } else if (key === 'ArrowRight') {
              newWidth = Math.min(newWidth + 1, imageWidth - newX);
            }
            break;
        }

        return { ...annotation, bbox: [newX, newY, newWidth, newHeight] };
      });
      // @ts-ignore
      saveAnnotationsToJson(updatedAnnotations);

      return updatedAnnotations; // ✅ updatedAnnotations 반환 (누락 X)
    });
  };

  // ✅ JSON 파일 저장 (최신 데이터 적용)
  const saveAnnotationsToJson = (updatedAnnotations: typeof annotations) => {
    window.api
      .saveAnnotations(`${imageFileName}_annotation`, {
        annotations: updatedAnnotations,
      })
      .catch((error) => console.error('Error saving updated annotations:', error));
  };

  useEffect(() => {
    const handleShiftArrowKey = (event: KeyboardEvent) => {
      if (!selectedSide || selectedAnnotations.length !== 1 || !event.shiftKey) return;

      const validKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      if (validKeys.includes(event.key)) {
        updateAnnotationBbox(event.key);
      }
    };

    document.addEventListener('keydown', handleShiftArrowKey);
    return () => document.removeEventListener('keydown', handleShiftArrowKey);
  }, [selectedSide, selectedAnnotations]);

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    >
      {annotations.map(({ id, bbox, class: annotationClass }) => {
        const [x, y, width, height] = bbox;
        const viewport = viewer.viewport;
        const topLeft = viewport.imageToViewportCoordinates(x, y);
        const bottomRight = viewport.imageToViewportCoordinates(x + width, y + height);
        const viewportWidth = bottomRight.x - topLeft.x;
        const viewportHeight = bottomRight.y - topLeft.y;

        const isSelected = selectedAnnotations.some((selectedId) => selectedId === id);
        const borderColor = classColors[annotationClass] || '#000000';
        // ✅ 가시성 체크
        const isVisible = showOnlyUnclassified
          ? annotationClass === 'Unclassified'
          : classVisibility[annotationClass] || isSelected; // 선택된 BBox는 항상 표시

        if (!isVisible) return null; // 가시성이 false면 렌더링 X
        return (
          <div
            key={id}
            style={{
              position: 'absolute',
              left: `${topLeft.x * 100}%`,
              top: `${topLeft.y * 100}%`,
              width: `${viewportWidth * 100}%`,
              height: `${viewportHeight * 100}%`,
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                border: `3px solid ${borderColor}`,
                boxSizing: 'border-box',
              }}
            ></div>

            {isSelected && (
              <div
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  border: '3px dashed yellow',
                  boxSizing: 'border-box',
                }}
              ></div>
            )}

            {isSelected && (
              <>
                {['top', 'bottom', 'left', 'right'].map((side) => {
                  const sideStyle = getSideStyle(side, viewportWidth, viewportHeight);
                  const isThisSideSelected = selectedSide?.id === id && selectedSide.side === side;

                  return (
                    <div
                      key={side}
                      style={{
                        ...sideStyle,
                        position: 'absolute',
                        backgroundColor: 'transparent',
                        border: isThisSideSelected ? '3px solid cyan' : 'none',
                        cursor: 'pointer',
                        pointerEvents: 'auto',
                      }}
                    ></div>
                  );
                })}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};

const getSideStyle = (side: string, width: number, height: number): React.CSSProperties => {
  const sidePositions: Record<string, React.CSSProperties> = {
    top: { left: '0%', top: '-3px', width: '100%', height: '6px' },
    bottom: { left: '0%', bottom: '-3px', width: '100%', height: '6px' },
    left: { left: '-3px', top: '0%', width: '6px', height: '100%' },
    right: { right: '-3px', top: '0%', width: '6px', height: '100%' },
  };

  return sidePositions[side];
};

export default AnnotationRenderer;
