import OpenSeadragon from 'openseadragon';
import React, { useEffect, useRef, useState } from 'react';
import { Annotation, AnnotationRendererProps, CustomOSDEvent } from '../types/annotationrenderer';

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
  useEffect(() => {
    window.api.onAnnotationsUpdated((data) => {
      setAnnotations((prevAnnotations) =>
        prevAnnotations.map((a) => {
          const updatedAnnotation = data.annotations.find((ann) => ann.id === a.id);
          return updatedAnnotation ? updatedAnnotation : a;
        })
      );
    });

    return () => {
      window.api.onAnnotationsUpdated(() => {}); // 리스너 정리
    };
  }, []);

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
    if (selectedAnnotations.length !== 1) return;

    const viewportPoint = viewer.viewport.pointFromPixel(event.position);
    const imagePoint = viewer.viewport.viewportToImageCoordinates(viewportPoint);

    const selectedId = selectedAnnotations[0];
    const selectedAnnotation = annotations.find((annotation) => annotation.id === selectedId);
    if (!selectedAnnotation) return;

    const [x, y, width, height] = selectedAnnotation.bbox;
    const isInsideBBox =
      imagePoint.x >= x &&
      imagePoint.x <= x + width &&
      imagePoint.y >= y &&
      imagePoint.y <= y + height;

    if (!isInsideBBox) return;

    setIsDragging(true);
    setDragStart(imagePoint);
    setDragOffset({
      x: imagePoint.x - x,
      y: imagePoint.y - y,
    });

    setSelectedAnnotations([selectedId]);

    viewer.panVertical = false;
    viewer.panHorizontal = false;
    viewer.gestureSettingsMouse.flickEnabled = false;
  };

  const handleMouseMove = (event: CustomOSDEvent) => {
    if (!isDragging || !dragStart || !dragOffset || selectedAnnotations.length !== 1) return;

    event.stopPropagation();

    const viewportPoint = viewer.viewport.pointFromPixel(event.position);
    const imagePoint = viewer.viewport.viewportToImageCoordinates(viewportPoint);

    const selectedId = selectedAnnotations[0];
    const selectedAnnotation = annotations.find((annotation) => annotation.id === selectedId);
    if (!selectedAnnotation) return;

    const tiledImage = viewer.world.getItemAt(0);
    if (!tiledImage) return;

    const { x: imageWidth, y: imageHeight } = tiledImage.getContentSize();

    let newX = Math.round(imagePoint.x - dragOffset.x);
    let newY = Math.round(imagePoint.y - dragOffset.y);

    newX = Math.max(0, Math.min(newX, imageWidth - selectedAnnotation.bbox[2]));
    newY = Math.max(0, Math.min(newY, imageHeight - selectedAnnotation.bbox[3]));

    const isOverlapping = annotations.some(({ id, bbox }) => {
      if (id === selectedId) return false;
      const [x, y, width, height] = bbox;
      return !(
        newX + selectedAnnotation.bbox[2] < x ||
        newX > x + width ||
        newY + selectedAnnotation.bbox[3] < y ||
        newY > y + height
      );
    });

    if (isOverlapping) return;

    setSelectedAnnotations([selectedId]);
  };

  const handleMouseUp = async (event: CustomOSDEvent) => {
    if (!isDragging || selectedAnnotations.length !== 1) return;

    setIsDragging(false);
    setDragStart(null);
    setDragOffset(null);

    viewer.panVertical = true;
    viewer.panHorizontal = true;
    viewer.gestureSettingsMouse.flickEnabled = true;

    const viewportPoint = viewer.viewport.pointFromPixel(event.position);
    const imagePoint = viewer.viewport.viewportToImageCoordinates(viewportPoint);

    const selectedId = selectedAnnotations[0];
    const updatedAnnotation = annotations.find((annotation) => annotation.id === selectedId);
    if (!updatedAnnotation) return;

    const tiledImage = viewer.world.getItemAt(0);
    if (!tiledImage) return;

    const { x: imageWidth, y: imageHeight } = tiledImage.getContentSize();

    const finalUpdatedAnnotation = {
      ...updatedAnnotation,
      bbox: [
        Math.max(
          0,
          Math.min(
            Math.round(imagePoint.x - (dragOffset?.x || 0)),
            imageWidth - updatedAnnotation.bbox[2]
          )
        ),
        Math.max(
          0,
          Math.min(
            Math.round(imagePoint.y - (dragOffset?.y || 0)),
            imageHeight - updatedAnnotation.bbox[3]
          )
        ),
        updatedAnnotation.bbox[2],
        updatedAnnotation.bbox[3],
      ],
    };

    try {
      await window.api.updateAnnotationBbox(`${imageFileName}_annotation`, finalUpdatedAnnotation);

      setAnnotations((prevAnnotations) =>
        prevAnnotations.map((annotation) =>
          annotation.id === selectedId ? finalUpdatedAnnotation : annotation
        )
      );

      setSelectedAnnotations([selectedId]);

      setTimeout(() => {
        setSelectedAnnotations([selectedId]);
      }, 1);
    } catch (error) {
      console.error('Error updating annotation position:', error);
    }
  };

  const handleCanvasDoubleClick = (event: CustomOSDEvent) => {
    if (isDragging) return; // ✅ 드래그 중에는 실행 안됨

    const viewportPoint = viewer.viewport.pointFromPixel(event.position);
    const imagePoint = viewer.viewport.viewportToImageCoordinates(viewportPoint);

    let clickedAnnotationId: string | null = null;
    let clickedSide: string | null = null;
    const borderTolerance = 2;

    annotations.forEach(({ id, bbox }) => {
      if (selectedAnnotations.includes(id)) return; // ✅ 이미 선택된 주석이면 무시

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
      setSelectedAnnotations([clickedAnnotationId]); // ✅ 새롭게 선택된 것만 반영
      setSelectedSide(clickedSide ? { id: clickedAnnotationId, side: clickedSide } : null);
    } else {
      setSelectedAnnotations([]); // 선택 해제
      setSelectedSide(null);
    }
  };

  // ✅ ALT + 클릭 (다중 선택 유지)
  const handleCanvasAltClick = (event: CustomOSDEvent) => {
    if (isDragging) return; // ✅ 드래그 중이면 실행 안됨
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
      setSelectedAnnotations((prevSelected) => {
        if (prevSelected.includes(clickedAnnotationId)) {
          return prevSelected.filter((id) => id !== clickedAnnotationId); // 🔥 이미 선택된 경우 해제
        } else {
          return [...prevSelected, clickedAnnotationId]; // 🔥 Alt + 클릭 시 다중 선택
        }
      });
      setSelectedSide(null);
    }
  };

  // ✅ OpenSeadragon 이벤트 핸들러 적용
  useEffect(() => {
    if (!viewer) return;

    viewer.addHandler('canvas-press', handleMouseDown);
    viewer.addHandler('canvas-drag', handleMouseMove);
    viewer.addHandler('canvas-release', handleMouseUp);
    viewer.addHandler('canvas-double-click', handleCanvasDoubleClick); // 🔥 더블클릭으로 선택
    viewer.addHandler('canvas-press', handleCanvasAltClick); // 🔥 Alt + 클릭으로 다중 선택

    return () => {
      viewer.removeHandler('canvas-press', handleMouseDown);
      viewer.removeHandler('canvas-drag', handleMouseMove);
      viewer.removeHandler('canvas-release', handleMouseUp);
      viewer.removeHandler('canvas-double-click', handleCanvasDoubleClick);
      viewer.removeHandler('canvas-press', handleCanvasAltClick);
    };
  }, [viewer, annotations, selectedAnnotations]);

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

  useEffect(() => {
    const handleShiftArrowKey = (event: KeyboardEvent) => {
      if (!event.shiftKey || selectedAnnotations.length !== 1) return;

      const validKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      if (!validKeys.includes(event.key)) return;

      event.preventDefault(); // 기본 동작 방지

      if (selectedSide) {
        // ✅ side가 선택된 상태에서는 크기 조절 실행
        updateAnnotationBbox(event.key);
      } else {
        // ✅ side가 선택되지 않은 경우에는 BBox 이동 실행
        moveSelectedAnnotation(event.key);
      }
    };

    document.addEventListener('keydown', handleShiftArrowKey);
    return () => document.removeEventListener('keydown', handleShiftArrowKey);
  }, [selectedAnnotations, selectedSide]);

  /**
   * 🔹 Shift + 방향키로 선택된 BBox 이동 (selectedSide가 없을 때만 실행)
   */
  const moveSelectedAnnotation = (key: string) => {
    if (!viewer || selectedAnnotations.length !== 1 || selectedSide) return;

    const tiledImage = viewer.world.getItemAt(0);
    if (!tiledImage) return;

    const { x: imageWidth, y: imageHeight } = tiledImage.getContentSize(); // 이미지 크기
    const moveStep = 1; // 1px 이동
    // @ts-ignore
    setAnnotations((prevAnnotations) => {
      return prevAnnotations.map((annotation) => {
        if (!selectedAnnotations.includes(annotation.id)) return annotation;

        const [x, y, width, height] = annotation.bbox;
        let newX = x,
          newY = y;

        switch (key) {
          case 'ArrowUp':
            newY = Math.max(y - moveStep, 0);
            break;
          case 'ArrowDown':
            newY = Math.min(y + moveStep, imageHeight - height);
            break;
          case 'ArrowLeft':
            newX = Math.max(x - moveStep, 0);
            break;
          case 'ArrowRight':
            newX = Math.min(x + moveStep, imageWidth - width);
            break;
          default:
            return annotation;
        }

        const updatedAnnotation = { ...annotation, bbox: [newX, newY, width, height] };

        // @ts-ignore
        window.api
          .moveAnnotation(`${imageFileName}`, updatedAnnotation)
          .then((response: { success: any }) => {
            if (response.success) {
            } else {
              console.error('❌ Failed to move annotation.');
            }
          })
          .catch((error: any) => {
            console.error('❌ Error moving annotation:', error);
          });

        return updatedAnnotation;
      });
    });
  };

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
