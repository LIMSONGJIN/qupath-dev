import React, { useEffect, useRef, useState } from "react";
import OpenSeadragon from "openseadragon";

interface Annotation {
  id: string;
  bbox: [number, number, number, number];
  class: string;
}

interface AnnotationRendererProps {
  annotations: Annotation[];
  viewer: OpenSeadragon.Viewer;
  selectedAnnotation: string | null;
  setSelectedAnnotation: (id: string | null) => void;
  selectedSide: { id: string; side: string } | null;
  setSelectedSide: (side: { id: string; side: string } | null) => void;
}

interface CustomOSDEvent extends OpenSeadragon.OSDEvent<any> {
  position: OpenSeadragon.Point;
}

const classColors: Record<string, string> = {
  "Unclassified": "#FF0000", // 빨강색
  "Class 1": "#0072B2",       // 진한 파랑색
  "Class 2": "#56B4E9",       // 하늘색
  "Class 3": "#90EE90",       // 연두색
  "Class 4": "#009E73",       // 청록색
  "Class 5": "#E69F00",       // 주황색
  "Class 6": "#D55E00",       // 주홍색
  "Class 7": "#CC79A7",       // 핑크색
  "Class 8": "#4B0082",       // 남보라색
  "Class 9": "#CCCCCC",       // 연회색
};

const AnnotationRenderer: React.FC<AnnotationRendererProps> = ({
  annotations,
  viewer,
  selectedAnnotation,
  setSelectedAnnotation,
  selectedSide,
  setSelectedSide,
}) => {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);

  useEffect(() => {
    // Alt + 숫자 키로 클래스 선택 기능 추가
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey) {
        const key = event.key;
        if (key === "0") {
          setSelectedClass("Unclassified");
        } else if (key >= "1" && key <= "9") {
          setSelectedClass(`Class ${key}`);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const handleCanvasDoubleClick = (event: CustomOSDEvent) => {
      const viewportPoint = viewer.viewport.pointFromPixel(event.position);
      const imagePoint = viewer.viewport.viewportToImageCoordinates(viewportPoint);

      let clickedAnnotationId: string | null = null;
      let clickedSide: string | null = null;
      const borderTolerance = 4;

      // annotation 클릭 여부 확인
      annotations.forEach(({ id, bbox }) => {
        const [x, y, width, height] = bbox;

        if (
          imagePoint.x >= x - borderTolerance &&
          imagePoint.x <= x + width + borderTolerance &&
          imagePoint.y >= y - borderTolerance &&
          imagePoint.y <= y + height + borderTolerance
        ) {
          clickedAnnotationId = id;

          if (Math.abs(imagePoint.y - y) <= borderTolerance) clickedSide = "top";
          else if (Math.abs(imagePoint.y - (y + height)) <= borderTolerance) clickedSide = "bottom";
          else if (Math.abs(imagePoint.x - x) <= borderTolerance) clickedSide = "left";
          else if (Math.abs(imagePoint.x - (x + width)) <= borderTolerance) clickedSide = "right";
        }
      });

      if (clickedAnnotationId) {
        // 클릭한 annotation이 이미 선택된 경우 처리
        if (selectedAnnotation === clickedAnnotationId) {
          if (clickedSide) {
            if (selectedSide?.id === clickedAnnotationId && selectedSide.side === clickedSide) {
              setSelectedSide(null);
            } else {
              setSelectedSide({ id: clickedAnnotationId, side: clickedSide });
            }
          } else {
            setSelectedSide(null);
          }
        } else {
          // 새로운 annotation 선택
          setSelectedAnnotation(clickedAnnotationId);
          setSelectedSide(null);
        }
      } else {
        // annotation 외부를 클릭한 경우: 전체 선택 해제
        setSelectedAnnotation(null);
        setSelectedSide(null);
        setSelectedClass(null); // 선택된 클래스도 해제
      }
    };

    if (overlayRef.current) {
      viewer.addOverlay({
        element: overlayRef.current as HTMLElement,
        location: new OpenSeadragon.Rect(0, 0, 1, 1),
      });
    }
    viewer.addHandler("canvas-double-click", handleCanvasDoubleClick);

    return () => viewer.removeHandler("canvas-double-click", handleCanvasDoubleClick);
  }, [annotations, selectedAnnotation, selectedSide, setSelectedAnnotation, setSelectedSide]);

  const viewport = viewer.viewport;

  return (
    <div ref={overlayRef} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
      {annotations.map(({ id, bbox, class: annotationClass }) => {
        const [x, y, width, height] = bbox;
        const topLeft = viewport.imageToViewportCoordinates(x, y);
        const bottomRight = viewport.imageToViewportCoordinates(x + width, y + height);
        const viewportWidth = bottomRight.x - topLeft.x;
        const viewportHeight = bottomRight.y - topLeft.y;

        const isSelectedClass = annotationClass === selectedClass;
        const isSelected = id === selectedAnnotation;
        const borderColor = classColors[annotationClass] || "#000000";

        return (
          <div
            key={id}
            style={{
              position: "absolute",
              left: `${topLeft.x * 100}%`,
              top: `${topLeft.y * 100}%`,
              width: `${viewportWidth * 100}%`,
              height: `${viewportHeight * 100}%`,
              pointerEvents: "none",
            }}
          >
            {/* 빨간 실선 테두리 */}
            <div
              style={{
                position: "absolute",
                width: "100%",
                height: "100%",
                border: `3px solid ${borderColor}`,
                boxSizing: "border-box",
              }}
            ></div>

            {/* 노란색 점선 테두리 (클래스 또는 개별 선택 시) */}
            {(isSelectedClass || isSelected) && (
              <div
                style={{
                  position: "absolute",
                  width: "100%",
                  height: "100%",
                  border: "3px dashed yellow",
                  boxSizing: "border-box",
                }}
              ></div>
            )}

            {/* 클릭 가능한 모서리 영역 */}
            {isSelected && (
              <>
                {["top", "bottom", "left", "right"].map((side) => {
                  const sideStyle = getSideStyle(side, viewportWidth, viewportHeight);
                  const isThisSideSelected = selectedSide?.id === id && selectedSide.side === side;

                  return (
                    <div
                      key={side}
                      style={{
                        ...sideStyle,
                        position: "absolute",
                        backgroundColor: "transparent",
                        border: isThisSideSelected ? "3px solid cyan" : "none",
                        cursor: "pointer",
                        pointerEvents: "auto",
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
    top: { left: "0%", top: "-3px", width: "100%", height: "6px" },
    bottom: { left: "0%", bottom: "-3px", width: "100%", height: "6px" },
    left: { left: "-3px", top: "0%", width: "6px", height: "100%" },
    right: { right: "-3px", top: "0%", width: "6px", height: "100%" },
  };

  return sidePositions[side];
};

export default AnnotationRenderer;