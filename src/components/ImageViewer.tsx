import React, { useEffect, useRef, useState } from "react";
import OpenSeadragon from "openseadragon";
import paper from "paper";
import Scalebar from "./ScaleBar";
import { IconButton } from "@mui/material";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import HomeIcon from "@mui/icons-material/Home";
import FullscreenIcon from "@mui/icons-material/Fullscreen";

const ImageViewer: React.FC = () => {
  const viewerRef = useRef<OpenSeadragon.Viewer | null>(null);
  const paperCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isViewerReady, setIsViewerReady] = useState(false);
  const [imageWidth, setImageWidth] = useState(0); // 이미지 크기 상태 추가

  useEffect(() => {
    if (!viewerRef.current) {
      const viewer = OpenSeadragon({
        element: document.getElementById("openseadragon") as HTMLElement,
        tileSources: {
          type: "image",
          url: "/images/1.png",
        },
        showNavigator: true,
        showNavigationControl: false,
        defaultZoomLevel: 0.9,
        visibilityRatio: 1,
        minZoomLevel: 0.1,
        maxZoomLevel: 20,
        constrainDuringPan: true,
        animationTime: 1.2,
        springStiffness: 7.0,
      });

      viewer.addHandler("open", () => {
        if (paperCanvasRef.current) {
          paper.setup(paperCanvasRef.current);
          drawGrid();
        }

        // 이미지 크기 가져와 상태에 저장
        const tiledImage = viewer.world.getItemAt(0);
        if (tiledImage) {
          setImageWidth(tiledImage.getContentSize().x);
        }

        viewer.viewport.fitBounds(tiledImage.getBounds(true));
        setIsViewerReady(true);
      });

      viewer.addHandler("zoom", drawGrid);
      viewer.addHandler("animation", drawGrid);
      viewerRef.current = viewer;
    }

    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, []);

  // Grid 그리기 함수
  const drawGrid = () => {
    if (!paper.view || !viewerRef.current) return;

    // 현재 줌 레벨과 뷰 크기 가져오기
    const zoom = viewerRef.current.viewport.getZoom();
    const bounds = viewerRef.current.viewport.getBounds();
    const gridSpacing = 100 / zoom; // 줌에 따라 간격 조정

    // 기존 그리기 레이어 초기화
    paper.project.activeLayer.removeChildren();

    // 격자 생성
    for (let x = Math.floor(bounds.x / gridSpacing) * gridSpacing; x < bounds.x + bounds.width; x += gridSpacing) {
      new paper.Path.Line({
        from: [x, bounds.y],
        to: [x, bounds.y + bounds.height],
        strokeColor: "gray",
        strokeWidth: 1,
      });
    }

    for (let y = Math.floor(bounds.y / gridSpacing) * gridSpacing; y < bounds.y + bounds.height; y += gridSpacing) {
      new paper.Path.Line({
        from: [bounds.x, y],
        to: [bounds.x + bounds.width, y],
        strokeColor: "gray",
        strokeWidth: 1,
      });
    }

    paper.view.update();
  };
  return (
    <div style={{ position: "relative", width: "800px", height: "800px", margin: "0 auto" }}>
      {/* OpenSeadragon 뷰어 */}
      <div
        id="openseadragon"
        style={{
          width: "100%",
          height: "100%",
          border: "1px solid #ccc",
          position: "relative",
        }}
      ></div>

      {/* Paper.js 캔버스 */}
      <canvas
        ref={paperCanvasRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      ></canvas>

      {/* Scalebar */}
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
          imageWidth={imageWidth} // 이미지 크기 전달
        />
      )}


      {/* MUI 도구 버튼들 */}
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
    </div>
  );
};

export default ImageViewer;
