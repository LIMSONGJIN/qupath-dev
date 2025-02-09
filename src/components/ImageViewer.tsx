import React, { useEffect, useRef, useState } from "react";
import OpenSeadragon from "openseadragon";
import { IconButton } from "@mui/material";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import HomeIcon from "@mui/icons-material/Home";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import Scalebar from "./ScaleBar";

interface Annotation {
  id: string;
  bbox: [number, number, number, number]; // [x, y, width, height]
  class: string;
}

interface ImageViewerProps {
  imageUrl: string;
  annotations: Annotation[];
}

const ImageViewer: React.FC<ImageViewerProps> = ({ imageUrl, annotations }) => {
  const viewerRef = useRef<OpenSeadragon.Viewer | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [isViewerReady, setIsViewerReady] = useState(false);
  const [imageWidth, setImageWidth] = useState(0);
  const [isToolbarVisible, setIsToolbarVisible] = useState(true);
  const hideTimerRef = useRef<number | null>(null);


  useEffect(() => {
    if (!viewerRef.current) {
      const viewer = OpenSeadragon({
        element: document.getElementById("openseadragon") as HTMLElement,
        tileSources: {
          type: "image",
          url: imageUrl,  // 초기 이미지 경로로 설정
        },
        showNavigator: true,
        showNavigationControl: false,
        defaultZoomLevel: 0.9,
        visibilityRatio: 0,
        minZoomLevel: 0.1,
        maxZoomLevel: 20,
        constrainDuringPan: true,
        animationTime: 1.2,
        springStiffness: 7.0,
        zoomPerClick: 1,
      });
      // 오버레이 설정
      if (overlayRef.current) {
        viewer.addOverlay({
          element: overlayRef.current,
          location: viewer.viewport.imageToViewportCoordinates(0, 0), // 초기 위치
        });
      }

      viewer.addHandler("open", () => {

        const tiledImage = viewer.world.getItemAt(0);
        if (tiledImage) {
          setImageWidth(tiledImage.getContentSize().x);
        }
        viewer.viewport.fitBounds(tiledImage.getBounds(true));
        setIsViewerReady(true);
      });

      const resetToolbarTimer = () => {
        setIsToolbarVisible(true);
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = window.setTimeout(() => setIsToolbarVisible(false), 3000);
      };

      viewer.addHandler("canvas-click", resetToolbarTimer);
      viewer.addHandler("canvas-drag", resetToolbarTimer);
      viewer.addHandler("canvas-scroll", resetToolbarTimer);

      viewerRef.current = viewer;    
    } else {
      viewerRef.current.open({ type: "image", url: imageUrl });
    }
  }, [imageUrl]);

  const renderAnnotations = () => {
    if (!viewerRef.current) return [];
  
    const viewer = viewerRef.current;
    const viewport = viewer.viewport;
    const imageSize = viewer.world.getItemAt(0)?.getContentSize();
  
    if (!imageSize) return [];
  
    return annotations.map(({ id, bbox }) => {
      const [x, y, width, height] = bbox;
  
      // 이미지 좌표를 뷰포트 좌표로 변환
      const topLeft = viewport.imageToViewportCoordinates(x, y);
      const bottomRight = viewport.imageToViewportCoordinates(x + width, y + height);
  
      // 뷰포트 상의 크기 계산
      const viewportWidth = bottomRight.x - topLeft.x;
      const viewportHeight = bottomRight.y - topLeft.y;
      viewer.addOverlay({
        element: overlayRef.current as HTMLElement,
        location: new OpenSeadragon.Rect(0, 0, 1, 1),  // 좌표 확인 필요
      });
      
      return (
        <div
          key={id}
          style={{
            position: "absolute",
            left: `${topLeft.x * 100}%`,
            top: `${topLeft.y * 100}%`,
            width: `${viewportWidth * 100}%`,
            height: `${viewportHeight * 100}%`,
            border: "2px solid red",
          }}
        ></div>
      );
    });
  };
  

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div
        id="openseadragon"
        style={{ width: "100%", height: "100%", position: "relative" }}
      ></div>

      {/* 오버레이 컨테이너 */}
      <div
        ref={overlayRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      >
        {renderAnnotations()}
      </div>
      {isViewerReady && viewerRef.current && imageWidth > 0 && (
        <Scalebar
          viewer={viewerRef.current}
          minWidthPx={200}
          location="BOTTOM_RIGHT"
          color="red"
          fontColor="white"
          backgroundColor="rgba(0, 0, 0, 0.7)"
          fontSize="14px"
          barThickness={6}
          imageWidth={imageWidth}
        />
      )}

        {isToolbarVisible && (
            <div
              style={{
                position: "absolute",
                top: "10px",
                left: "10px",
                zIndex: 1000,
                display: "flex",
                gap: "10px",
                backgroundColor: "rgba(255, 255, 255, 0.8)",
                borderRadius: "8px",
                padding: "5px",
                transition: "opacity 0.5s ease",
          }}
        >
          <IconButton onClick={() => viewerRef.current?.viewport.zoomBy(1.2).applyConstraints()} color="primary">
            <ZoomInIcon />
          </IconButton>
          <IconButton onClick={() => viewerRef.current?.viewport.zoomBy(0.8).applyConstraints()} color="primary">
            <ZoomOutIcon />
          </IconButton>
          <IconButton onClick={() => viewerRef.current?.viewport.goHome()} color="primary">
            <HomeIcon />
          </IconButton>
          <IconButton onClick={() => viewerRef.current?.setFullScreen(!viewerRef.current.isFullPage())} color="primary">
            <FullscreenIcon />
          </IconButton>
        </div>
      )}
    </div>
    
  );
};

export default ImageViewer;
