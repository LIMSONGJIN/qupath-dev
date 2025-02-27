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
  classes,
  setAnnotationsUnsaved,
}) => {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const oldAnnotationRef = useRef<Annotation | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [classVisibility, setClassVisibility] = useState<Record<string, boolean>>({});
  const [isHoldingMouse, setIsHoldingMouse] = useState(false); // ✅ 마우스를 클릭한 상태인지 추적
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);

  const { performCommand } = useUndoRedo();

  // 1. classes prop가 변경되면 기본적으로 모든 클래스는 표시하도록 가시성 초기화
  useEffect(() => {
    const visibility = classes.reduce((acc, curr) => {
      acc[curr.name] = true;
      return acc;
    }, {} as Record<string, boolean>);
    setClassVisibility(visibility);
  }, [classes]);

  // 3. 키보드 이벤트로 클래스 가시성 토글 (V, F키 등)
  useEffect(() => {
    let prevSelectedAnnotations: string[] = []; // 이전 선택 상태 저장
    let isVPressed = false;
    let vKeyTimeout: number | null = null;

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      // Shift키와 함께 V는 무시
      if (key === 'v' && event.shiftKey) return;

      if (key === 'v') {
        isVPressed = true;
        if (vKeyTimeout) clearTimeout(vKeyTimeout);
        vKeyTimeout = window.setTimeout(() => {
          setClassVisibility((prev) => {
            const anyVisible = Object.values(prev).some((v) => v);
            if (anyVisible) {
              prevSelectedAnnotations = selectedAnnotations;
              setSelectedAnnotations([]); // 모두 선택 해제
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
        }, 200);
        return;
      }

      if (isVPressed && !isNaN(parseInt(key))) {
        if (vKeyTimeout) {
          clearTimeout(vKeyTimeout);
          vKeyTimeout = null;
        }
        const classIndex = parseInt(key);
        const className = classIndex === 0 ? 'Unclassified' : `Class ${classIndex}`;
        setClassVisibility((prev) => ({
          ...prev,
          [className]: !prev[className],
        }));
        isVPressed = false;
        return;
      }

      if (key === 'f') {
        setClassVisibility((prev) => {
          const isUnclassifiedOnly = Object.keys(prev).every(
            (key) => key === 'Unclassified' || !prev[key]
          );
          if (!isUnclassifiedOnly) {
            prevSelectedAnnotations = selectedAnnotations;
            setSelectedAnnotations([]);
          } else {
            setSelectedAnnotations(prevSelectedAnnotations);
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

  // getClassColor 함수: classes prop을 이용해 클래스 이름에 해당하는 색상을 반환
  const getClassColor = (className: string): string => {
    const found = classes.find((cls) => cls.name === className);
    return found ? found.color : '#000000';
  };

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

    // 1) 드래그 시작 시점의 "원래 bbox"를 oldAnnotationRef에 저장
    oldAnnotationRef.current = {
      ...selectedAnnotation,
      bbox: [...selectedAnnotation.bbox],
    };

    setIsDragging(true);
    setIsHoldingMouse(true);
    setMousePosition(imagePoint);
    setDragOffset({
      x: imagePoint.x - x,
      y: imagePoint.y - y,
    });

    setSelectedAnnotations([selectedId]);
    // @ts-ignore
    viewer.panVertical = false;
    // @ts-ignore
    viewer.panHorizontal = false;
    // @ts-ignore
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

    // 드래그 종료 후 상태 초기화
    setIsDragging(false);
    setIsHoldingMouse(false);
    setMousePosition(null);
    setDragOffset(null);
    // @ts-ignore
    viewer.panVertical = true;
    // @ts-ignore
    viewer.panHorizontal = true;
    // @ts-ignore
    viewer.gestureSettingsMouse.flickEnabled = true;

    const selectedId = selectedAnnotations[0];
    // ─────────────────────────────────────────────────────────────
    // 1) "드래그 시작 시점"의 bbox를 가져옴
    const oldSelectedAnnotation = oldAnnotationRef.current;
    if (!oldSelectedAnnotation) {
      // 혹시 null이면 그냥 return
      return;
    }

    console.log('Initial (old) bounding box for', selectedId, ':', oldSelectedAnnotation.bbox);

    // 현재(드래그 끝) 시점의 annotation은 이미 "실시간 이동"이 반영된 상태일 수 있음
    // 그래도 find 해보겠습니다.
    const currentAnnotation = annotations.find((a) => a.id === selectedId);
    if (!currentAnnotation) return;

    // 뷰포트 → 이미지 좌표 계산
    const viewportPoint = viewer.viewport.pointFromPixel(event.position);
    const imagePoint = viewer.viewport.viewportToImageCoordinates(viewportPoint);

    const tiledImage = viewer.world.getItemAt(0);
    if (!tiledImage) return;
    const { x: imageWidth, y: imageHeight } = tiledImage.getContentSize();

    const newX = Math.max(
      0,
      Math.min(
        Math.round(imagePoint.x - (dragOffset?.x || 0)),
        imageWidth - currentAnnotation.bbox[2]
      )
    );
    const newY = Math.max(
      0,
      Math.min(
        Math.round(imagePoint.y - (dragOffset?.y || 0)),
        imageHeight - currentAnnotation.bbox[3]
      )
    );

    const newSelectedAnnotation = {
      ...currentAnnotation,
      bbox: [newX, newY, currentAnnotation.bbox[2], currentAnnotation.bbox[3]],
    };

    console.log('Final (new) bounding box for', selectedId, ':', newSelectedAnnotation.bbox);

    const newAnnotations = annotations.map((a) =>
      a.id === selectedId ? newSelectedAnnotation : a
    );

    try {
      // @ts-ignore
      setAnnotations(newAnnotations);
      setSelectedAnnotations([selectedId]);
      setTimeout(() => {
        setSelectedAnnotations([selectedId]);
      }, 50);
    } catch (error) {
      console.error('Error updating annotation position:', error);
      return;
    }

    // (2) Undo/Redo 등록에서 파일 저장 호출 제거
    performCommand({
      redo: () => {
        // @ts-ignore
        setAnnotations((prev) =>
          prev.map((a) => (a.id === selectedId ? newSelectedAnnotation : a))
        );
        // 🔥 여기서 파일 저장을 호출하지 않고, unsaved만 표시
        setAnnotationsUnsaved(true);
      },
      undo: () => {
        setAnnotations((prev) =>
          prev.map((a) => (a.id === selectedId ? oldSelectedAnnotation : a))
        );
        setAnnotationsUnsaved(true);
      },
    });

    // 마지막에 oldAnnotationRef 초기화
    oldAnnotationRef.current = null;
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
    if (isDragging) return; // 🚀 드래그 중이면 실행 안 함

    // 기존 더블 클릭 로직 유지
    const viewportPoint = viewer.viewport.pointFromPixel(event.position);
    const imagePoint = viewer.viewport.viewportToImageCoordinates(viewportPoint);

    let clickedAnnotationId: string | null = null;
    let clickedSide: string | null = null;
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
        if (Math.abs(imagePoint.y - y) <= borderTolerance) clickedSide = 'top';
        else if (Math.abs(imagePoint.y - (y + height)) <= borderTolerance) clickedSide = 'bottom';
        else if (Math.abs(imagePoint.x - x) <= borderTolerance) clickedSide = 'left';
        else if (Math.abs(imagePoint.x - (x + width)) <= borderTolerance) clickedSide = 'right';
      }
    });

    if (clickedAnnotationId) {
      setSelectedAnnotations([clickedAnnotationId]);
      setSelectedSide(clickedSide ? { id: clickedAnnotationId, side: clickedSide } : null);
    } else {
      setSelectedAnnotations([]);
      setSelectedSide(null);
    }
  };

  // ✅ Ctrl + 클릭 (다중 선택 유지)
  const handleCanvasCtrlClick = (event: CustomOSDEvent) => {
    if (isDragging) return; // ✅ 드래그 중이면 실행 안됨
    if (!event.originalEvent.ctrlKey) return; // Ctrl 키가 없으면 실행 안 함
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
      setSelectedAnnotations((prevSelected) => {
        if (prevSelected.includes(clickedAnnotationId)) {
          return prevSelected.filter((id: string | null) => id !== clickedAnnotationId); // 🔥 이미 선택된 경우 해제
        } else {
          return [...prevSelected, clickedAnnotationId]; // 🔥 Ctrl + 클릭 시 다중 선택
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
    viewer.addHandler('canvas-press', handleCanvasCtrlClick); // 🔥 Ctrl + 클릭으로 다중 선택

    return () => {
      viewer.removeHandler('canvas-press', handleMouseDown);
      viewer.removeHandler('canvas-drag', handleMouseMove);
      viewer.removeHandler('canvas-release', handleMouseUp);
      viewer.removeHandler('canvas-double-click', handleCanvasDoubleClick);
      viewer.removeHandler('canvas-press', handleCanvasCtrlClick);
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
        setAnnotations(newAnnotations);
        // 🔥 파일 저장 제거
        setAnnotationsUnsaved(true);
      },
      undo: () => {
        setAnnotations(oldAnnotations);
        setAnnotationsUnsaved(true);
      },
    });

    // 선택 상태 초기화
    setSelectedAnnotations([]);
    setSelectedSide(null);
  };

  useEffect(() => {
    const handleKeyDown = async (event: KeyboardEvent) => {
      const key = event.key;
      // ✅ Ctrl + 숫자키: 해당 클래스에 속한 어노테이션 선택
      if (event.ctrlKey && key >= '0' && key <= '9') {
        event.preventDefault();
        const selectedClass = key === '0' ? 'Unclassified' : `Class ${key}`;
        setSelectedAnnotations(
          annotations
            .filter((annotation) => annotation.class === selectedClass)
            .map((annotation) => annotation.id)
        );
        return;
      }
      // Delete 키: 선택된 어노테이션 삭제
      if (key === 'Delete' && selectedAnnotations.length > 0) {
        event.preventDefault();
        event.stopPropagation();
        deleteSelectedAnnotations();
        return;
      }
      // 숫자키 단독: 클래스 변경 (undo/redo 적용)
      if (key >= '0' && key <= '9') {
        const classId = parseInt(key);
        // allClasses 대신 전달받은 classes를 사용합니다.
        const targetClass = classes.find((cls) => cls.id === classId);
        if (!targetClass) {
          console.warn(`No class found for ID=${classId}`);
          return;
        }
        const newClassName = targetClass.name;

        // 변경 전 상태 캡처
        const oldAnnotations = [...annotations];
        // 선택된 어노테이션에 대해 클래스 변경 적용
        const newAnnotations = annotations.map((annotation) =>
          selectedAnnotations.includes(annotation.id)
            ? { ...annotation, class: newClassName }
            : annotation
        );

        // performCommand로 undo/redo 등록
        performCommand({
          redo: () => {
            setAnnotations(newAnnotations);
            setAnnotationsUnsaved(true);
          },
          undo: () => {
            setAnnotations(oldAnnotations);
            setAnnotationsUnsaved(true);
          },
        });

        // 상태 업데이트 적용 (redo 함수에서도 실행됨)
        setAnnotations(newAnnotations);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedAnnotations, annotations, classes, imageFileName, performCommand]);

  useEffect(() => {
    const handleArrowKey = (event: KeyboardEvent) => {
      // Shift 키가 눌렸다면 side 토글 로직 실행 X
      if (event.shiftKey) return;

      if (selectedAnnotations.length !== 1) return; // 하나의 annotation만 선택된 경우에만 동작

      const selectedId = selectedAnnotations[0];
      const selectedAnnotation = annotations.find((a) => a.id === selectedId);
      if (!selectedAnnotation) return;

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

      // 동일한 화살표 키를 다시 누르면 선택 해제, 다른 키면 변경
      if (selectedSide && selectedSide.id === selectedId && selectedSide.side === newSide) {
        setSelectedSide(null);
      } else {
        setSelectedSide({ id: selectedId, side: newSide });
      }
    };

    document.addEventListener('keydown', handleArrowKey);
    return () => document.removeEventListener('keydown', handleArrowKey);
  }, [selectedAnnotations, annotations, selectedSide, setSelectedSide]);

  // 동기적으로 bbox 크기 조절 결과를 반환하는 함수
  const updateAnnotationBboxSync = (
    key: string,
    currentAnnotations: Annotation[]
  ): Annotation[] => {
    if (!viewer) return currentAnnotations;
    const tiledImage = viewer.world.getItemAt(0);
    if (!tiledImage) return currentAnnotations;
    const { x: imageWidth, y: imageHeight } = tiledImage.getContentSize();
    const minSize = 1;

    return currentAnnotations.map((annotation) => {
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
  };

  // 동기적으로 BBox 이동 결과를 반환하는 함수 (selectedSide가 없을 때)
  const moveSelectedAnnotationSync = (
    key: string,
    currentAnnotations: Annotation[]
  ): Annotation[] => {
    if (!viewer || selectedAnnotations.length !== 1 || selectedSide) return currentAnnotations;
    const tiledImage = viewer.world.getItemAt(0);
    if (!tiledImage) return currentAnnotations;
    const { x: imageWidth, y: imageHeight } = tiledImage.getContentSize();
    const moveStep = 1;

    return currentAnnotations.map((annotation) => {
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
      return { ...annotation, bbox: [newX, newY, width, height] };
    });
  };

  useEffect(() => {
    let commandTimeout: number | null = null;

    const handleShiftArrowKey = (event: KeyboardEvent) => {
      if (!event.shiftKey || selectedAnnotations.length !== 1) return;
      const validKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      if (!validKeys.includes(event.key)) return;

      event.preventDefault(); // 기본 동작 방지

      setAnnotations((prevAnnotations) => {
        const oldAnnotations = prevAnnotations.map((a) => ({
          ...a,
          bbox: [...a.bbox],
        }));

        // selectedSide가 있으면 bbox 크기 조절, 없으면 이동 처리
        const newAnnotations = selectedSide
          ? updateAnnotationBboxSync(event.key, prevAnnotations)
          : moveSelectedAnnotationSync(event.key, prevAnnotations);

        // 🔥 파일 저장 제거 → unsaved = true
        // setAnnotationsUnsaved(true);

        // 디바운스
        if (commandTimeout) {
          clearTimeout(commandTimeout);
        }
        commandTimeout = window.setTimeout(() => {
          performCommand({
            redo: () => {
              setAnnotations(newAnnotations);
              setAnnotationsUnsaved(true);
            },
            undo: () => {
              // @ts-ignore=
              setAnnotations(oldAnnotations);
              setAnnotationsUnsaved(true);
            },
          });
          commandTimeout = null;
        }, 100);

        return newAnnotations;
      });
    };

    document.addEventListener('keydown', handleShiftArrowKey);
    return () => {
      if (commandTimeout) clearTimeout(commandTimeout);
      document.removeEventListener('keydown', handleShiftArrowKey);
    };
  }, [selectedAnnotations, selectedSide, imageFileName, viewer, performCommand]);

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
        const borderColor = getClassColor(annotationClass);
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
