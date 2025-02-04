import React, { useEffect, useRef, useState } from "react";
import OpenSeadragon from "openseadragon";
import paper from "paper";
import Scalebar from "./ScaleBar";
import { IconButton } from "@mui/material";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import HomeIcon from "@mui/icons-material/Home";
import FullscreenIcon from "@mui/icons-material/Fullscreen";

interface ImageViewerProps {
  imageUrl: string;
}
const ImageViewer: React.FC = () => {
  const viewerRef = useRef<OpenSeadragon.Viewer | null>(null);
  const paperCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isViewerReady, setIsViewerReady] = useState(false);
  const [imageWidth, setImageWidth] = useState(0);
  const [isToolbarVisible, setIsToolbarVisible] = useState(true); // Toolbar visibility state
  const hideTimerRef = useRef<number | null>(null);

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
        visibilityRatio: 0,
        minZoomLevel: 0.1,
        maxZoomLevel: 20,
        constrainDuringPan: true,
        animationTime: 1.2,
        springStiffness: 7.0,
        zoomPerClick: 1,          // 클릭 시 줌 비활성화 (줌 배율 1)
      });

      viewer.addHandler("open", () => {
        if (paperCanvasRef.current) {
          paper.setup(paperCanvasRef.current);
          drawGrid();
        }
        if (viewer.container) {
          viewer.container.style.backgroundColor = '#000000';  // 검은색 배경 설정
        }
        const tiledImage = viewer.world.getItemAt(0);
        if (tiledImage) {
          setImageWidth(tiledImage.getContentSize().x);
        }

        viewer.viewport.fitBounds(tiledImage.getBounds(true));
        setIsViewerReady(true);
      });

      viewer.addHandler("zoom", drawGrid);
      viewer.addHandler("animation", drawGrid);

      // Add event handlers to reset toolbar hide timer on interaction
      const resetToolbarTimer = () => {
        setIsToolbarVisible(true);
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = window.setTimeout(() => setIsToolbarVisible(false), 3000);
      };

      viewer.addHandler("canvas-click", resetToolbarTimer);
      viewer.addHandler("canvas-drag", resetToolbarTimer);
      viewer.addHandler("canvas-scroll", resetToolbarTimer);

      viewerRef.current = viewer;
      resetToolbarTimer();
    }

    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, []);

  const drawGrid = () => {
    if (!paper.view || !viewerRef.current) return;

    const zoom = viewerRef.current.viewport.getZoom();
    const bounds = viewerRef.current.viewport.getBounds();
    const gridSpacing = 100 / zoom;

    paper.project.activeLayer.removeChildren();

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
    <div style={{ position: "relative", width: "100%", height: "100%", margin: "0 auto" , overflow: "hidden"}}>
      <div
        id="openseadragon"
        style={{
          width: "100%",
          height: "100%",
          border: "1px solid #ccc",
          position: "relative",
        }}
      ></div>
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
