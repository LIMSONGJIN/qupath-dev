import OpenSeadragon from 'openseadragon';
import React, { useEffect, useRef, useState } from 'react';
import { useUndoRedo } from '../context/UndoRedoContext';
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
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [classColors, setClassColors] = useState<Record<string, string>>({});
  const [classVisibility, setClassVisibility] = useState<Record<string, boolean>>({});
  const [isHoldingMouse, setIsHoldingMouse] = useState(false); // ✅ 마우스를 클릭한 상태인지 추적
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);
  const [allClasses, setAllClasses] = useState<{ id: number; name: string; color: string }[]>([]);

  const { performCommand } = useUndoRedo();

  useEffect(() => {
    const fetchClasses = async () => {
      const response = await window.api.getClasses();
      if (response.success) {
        setAllClasses(response.classes);
      }
    };
    fetchClasses();
  }, []);

  useEffect(() => {
    if (!viewer || !overlayRef.current) return;

    // 🔥 OpenSeadragon에 오버레이 추가 (한 번만)
    viewer.addOverlay({
      element: overlayRef.current as HTMLElement,
      location: new OpenSeadragon.Rect(0, 0, 1, 1),
    });

    // ✅ 어노테이션 업데이트 (뷰포트 변경 시)
    const updateOverlays = () => {
      annotations.forEach(({ id, bbox }) => {
        const [x, y, width, height] = bbox;
        const viewportRect = viewer.viewport.imageToViewportRectangle(
          new OpenSeadragon.Rect(x, y, width, height)
        );

        const element = document.getElementById(`annotation-${id}`);
        if (element) {
          element.style.left = `${viewportRect.x * 100}%`;
          element.style.top = `${viewportRect.y * 100}%`;
          element.style.width = `${viewportRect.width * 100}%`;
          element.style.height = `${viewportRect.height * 100}%`;
        }
      });
    };

    viewer.addHandler('viewport-change', updateOverlays);
    updateOverlays(); // 초기 업데이트 실행

    return () => {
      viewer.removeHandler('viewport-change', updateOverlays);
    };
  }, [viewer, annotations]);

  useEffect(() => {
    window.api.onAnnotationsUpdated((data) => {
      setAnnotations((prevAnnotations) =>
        prevAnnotations.map((a) => {
          const updatedAnnotation = data.annotations.find((ann: { id: string }) => ann.id === a.id);
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
    let prevSelectedAnnotations: string[] = []; // 🔥 이전 선택 상태 저장
    let isVPressed = false;
    let vKeyTimeout: number | null = null;

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      // Shift키가 V에 대해서는 무시
      if (key === 'v' && event.shiftKey) return;

      if (key === 'v') {
        // V키 단독 또는 V + 숫자키를 구분하기 위해 플래그 설정 및 타임아웃 시작
        isVPressed = true;

        if (vKeyTimeout) {
          clearTimeout(vKeyTimeout);
        }
        vKeyTimeout = window.setTimeout(() => {
          // 타임아웃 내에 숫자키가 없으면 V키 단독으로 전체 토글 실행
          setClassVisibility((prev) => {
            const anyVisible = Object.values(prev).some((v) => v);
            if (anyVisible) {
              prevSelectedAnnotations = selectedAnnotations;
              setSelectedAnnotations([]); // 모든 선택 해제
            } else {
              setSelectedAnnotations(prevSelectedAnnotations); // 이전 선택 복구
            }
            const newVisibility = Object.keys(prev).reduce((acc, key) => {
              acc[key] = !anyVisible; // 모든 클래스 가시성 반전
              return acc;
            }, {} as Record<string, boolean>);
            console.log('🔄 New Class Visibility:', newVisibility);
            return newVisibility;
          });
          isVPressed = false;
          vKeyTimeout = null;
        }, 300); // 타임아웃 시간은 필요에 따라 조정
        return;
      }

      // V키가 눌린 상태에서 숫자키 입력이면 개별 클래스 토글 처리
      if (isVPressed && !isNaN(parseInt(key))) {
        if (vKeyTimeout) {
          clearTimeout(vKeyTimeout);
          vKeyTimeout = null;
        }
        const classIndex = parseInt(key);
        const className = classIndex === 0 ? 'Unclassified' : `Class ${classIndex}`;
        setClassVisibility((prev) => ({
          ...prev,
          [className]: !prev[className], // 개별 토글
        }));
        isVPressed = false;
        return;
      }

      if (key === 'f') {
        // F키: Unclassified(미분류)만 보이도록 토글
        setClassVisibility((prev) => {
          const isUnclassifiedOnly = Object.keys(prev).every(
            (key) => key === 'Unclassified' || !prev[key]
          );
          if (!isUnclassifiedOnly) {
            // 🔥 기존 선택된 것 저장 후 초기화
            prevSelectedAnnotations = selectedAnnotations;
            setSelectedAnnotations([]);
          } else {
            setSelectedAnnotations(prevSelectedAnnotations); // 🔥 복구
          }
          const newVisibility = Object.keys(prev).reduce((acc, key) => {
            acc[key] = isUnclassifiedOnly ? true : key === 'Unclassified';
            return acc;
          }, {} as Record<string, boolean>);
          console.log('🔄 Updated Class Visibility:', newVisibility);
          return newVisibility;
        });
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'v') {
        isVPressed = false;
        if (vKeyTimeout) {
          clearTimeout(vKeyTimeout);
          vKeyTimeout = null;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedAnnotations]);

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
    setIsHoldingMouse(true); // ✅ 마우스를 클릭했음을 표시
    setMousePosition(imagePoint); // ✅ 마우스 위치 업데이트
    setDragOffset({
      x: imagePoint.x - x,
      y: imagePoint.y - y,
    });

    setSelectedAnnotations([selectedId]);

    viewer.panVertical = false;
    viewer.panHorizontal = false;
    viewer.gestureSettingsMouse.flickEnabled = false;
  };

  // handleMouseMove 내부
  const handleMouseMove = (event: CustomOSDEvent) => {
    if (!isDragging) return;

    const viewportPoint = viewer.viewport.pointFromPixel(event.position);
    const imagePoint = viewer.viewport.viewportToImageCoordinates(viewportPoint);

    // 계속 mousePosition을 최신 상태로 갱신
    setMousePosition(imagePoint);
  };

  const handleMouseUp = async (event: CustomOSDEvent) => {
    if (!isDragging || selectedAnnotations.length !== 1) return;

    setIsDragging(false);
    setIsHoldingMouse(false); // ✅ 마우스를 놓았음을 표시
    setMousePosition(null);
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
      }, 50);
    } catch (error) {
      console.error('Error updating annotation position:', error);
    }
  };

  useEffect(() => {
    // 드래그 중이 아니거나, 선택된 어노테이션이 없으면 아무것도 안 함
    if (!isHoldingMouse || selectedAnnotations.length !== 1) return;
    if (!mousePosition) return; // mousePosition이 없으면 아직 드래그가 안 시작된 것

    const selectedId = selectedAnnotations[0];
    const selectedAnnotation = annotations.find((annotation) => annotation.id === selectedId);
    if (!selectedAnnotation) return;

    const tiledImage = viewer.world.getItemAt(0);
    if (!tiledImage) return;

    const { x: imageWidth, y: imageHeight } = tiledImage.getContentSize();

    // 마우스 위치 기반으로 bbox 계산 (fallback 제거)
    let newX = Math.round(mousePosition.x - (dragOffset?.x || 0));
    let newY = Math.round(mousePosition.y - (dragOffset?.y || 0));

    newX = Math.max(0, Math.min(newX, imageWidth - selectedAnnotation.bbox[2]));
    newY = Math.max(0, Math.min(newY, imageHeight - selectedAnnotation.bbox[3]));

    setAnnotations((prevAnnotations) =>
      prevAnnotations.map((annotation) =>
        annotation.id === selectedId
          ? { ...annotation, bbox: [newX, newY, annotation.bbox[2], annotation.bbox[3]] }
          : annotation
      )
    );
  }, [isHoldingMouse, mousePosition, selectedAnnotations, dragOffset, annotations, viewer]);

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
    if (!event.originalEvent.ctrlKey) return; // Alt 키가 없으면 실행 안 함
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

    // 삭제하기 전 전체 어노테이션 배열 캡처 (복원용)
    const oldAnnotations = [...annotations];
    // 삭제 후 어노테이션 배열
    const newAnnotations = annotations.filter(
      (annotation) => !selectedAnnotations.includes(annotation.id)
    );

    // Undo/Redo 명령 객체 등록
    performCommand({
      redo: () => {
        setAnnotations(() => newAnnotations);
        window.api
          .saveAnnotations(`${imageFileName}_annotation`, {
            annotations: newAnnotations,
          })
          .catch((error) => console.error('Error saving annotations on redo (delete):', error));
      },
      undo: () => {
        setAnnotations(() => oldAnnotations);
        window.api
          .saveAnnotations(`${imageFileName}_annotation`, {
            annotations: oldAnnotations,
          })
          .catch((error) => console.error('Error saving annotations on undo (delete):', error));
      },
    });

    // 선택 상태 초기화
    setSelectedAnnotations([]);
    setSelectedSide(null);
  };

  //
  useEffect(() => {
    const handleKeyDown = async (event: KeyboardEvent) => {
      const key = event.key;
      // ✅ Ctrl + 숫자키로 해당 클래스에 속한 어노테이션을 선택
      if (event.ctrlKey && key >= '0' && key <= '9') {
        event.preventDefault(); // 기본 브라우저 동작 방지

        const selectedClass = key === '0' ? 'Unclassified' : `Class ${key}`;

        setSelectedAnnotations(
          annotations
            .filter((annotation) => annotation.class === selectedClass)
            .map((annotation) => annotation.id)
        );
        return;
      }
      // Delete 키 처리: 선택된 어노테이션이 있으면 모달 띄우기
      if (key === 'Delete' && selectedAnnotations.length > 0) {
        event.preventDefault();
        event.stopPropagation();
        deleteSelectedAnnotations();
        return;
      }
      if (key >= '0' && key <= '9') {
        const classId = parseInt(key); // 숫자
        const targetClass = allClasses.find((cls) => cls.id === classId);
        if (!targetClass) {
          console.warn(`No class found for ID=${classId}`);
          return;
        }
        const newClassName = targetClass.name; // 예: 'Class 12'

        // 이제 newClassName을 적용
        setAnnotations((prevAnnotations) =>
          prevAnnotations.map((annotation) =>
            selectedAnnotations.includes(annotation.id)
              ? { ...annotation, class: newClassName }
              : annotation
          )
        );

        // API 저장
        try {
          const response = await window.api.saveAnnotations(`${imageFileName}_annotation`, {
            annotations: annotations.map((annotation) =>
              selectedAnnotations.includes(annotation.id)
                ? { ...annotation, class: newClassName }
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

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedAnnotations, annotations, imageFileName]);

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
        const isVisible = classVisibility[annotationClass] || isSelected; // 선택된 BBox는 항상 표시

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
