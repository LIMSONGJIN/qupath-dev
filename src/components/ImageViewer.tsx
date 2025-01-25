import { useEffect, useRef, useState } from "react";
import OpenSeadragon from "openseadragon";
import { IconButton } from "@mui/material";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import HomeIcon from "@mui/icons-material/Home";
import FullscreenIcon from "@mui/icons-material/Fullscreen";

function ImageViewer() {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [imageInfo, setImageInfo] = useState({
    oriX: 0,
    oriY: 0,
    mmX: 0,
    mmY: 0,
    mmXUnit: "µm",
    mmYUnit: "µm",
  });

  const RESIZE_RATIO = 1; // 이미지 크기 조정 비율
  const umPerPixel = 0.5; // 픽셀당 마이크로미터 (예: 20x 확대)

  useEffect(() => {
    if (viewerRef.current) {
      const viewer = OpenSeadragon({
        element: viewerRef.current,
        tileSources: {
          type: "image",
          url: "/images/2.png", // PNG 이미지 경로
        },
        showNavigator: true,
        defaultZoomLevel: 1,
        minZoomLevel: 1,
        maxZoomLevel: 10,
        visibilityRatio: 1.0,
        constrainDuringPan: true,
        zoomPerScroll: 1.5, // 스크롤 줌 속도 조정 (기본값: 1.2)
        zoomInButton: "zoom-in", // Zoom In 버튼 ID
        zoomOutButton: "zoom-out", // Zoom Out 버튼 ID
        homeButton: "home", // Home 버튼 ID
        fullPageButton: "full-page", // Full Page 버튼 ID
      });

      // 클릭 줌 비활성화
      viewer.addHandler("canvas-click", (event) => {
        event.preventDefaultAction = true; // 기본 클릭 동작 방지
      });

      viewer.addHandler("open", () => {
        const tracker = new OpenSeadragon.MouseTracker({
          element: viewer.container,
          moveHandler: function (event) {
            const webPoint = event.position; // 마우스 웹 좌표
            const viewportPoint = viewer.viewport.pointFromPixel(webPoint); // 뷰포트 좌표
            const imagePoint = viewer.viewport.viewportToImageCoordinates(viewportPoint); // 이미지 좌표

            const oriX = Math.round(imagePoint.x * RESIZE_RATIO);
            const oriY = Math.round(imagePoint.y * RESIZE_RATIO);

            let mmX = oriX * umPerPixel;
            let mmY = oriY * umPerPixel;
            let mmXUnit = "µm";
            let mmYUnit = "µm";

            if (mmX > 1000) {
              mmX = mmX / 1000;
              mmXUnit = "mm";
            }
            if (mmY > 1000) {
              mmY = mmY / 1000;
              mmYUnit = "mm";
            }

            setImageInfo({
              oriX,
              oriY,
              mmX: parseFloat(mmX.toFixed(2)),
              mmY: parseFloat(mmY.toFixed(2)),
              mmXUnit,
              mmYUnit,
            });
          },
        });

        tracker.setTracking(true);
      });

      return () => viewer.destroy();
    }
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center", // 가운데 정렬
        justifyContent: "center", // 수직 가운데 정렬
        height: "100vh", // 화면 전체 높이 사용
      }}
    >
      {/* 이미지 뷰어 */}
      <div
        ref={viewerRef}
        style={{
          width: "600px",
          height: "600px",
          border: "1px solid black",
          position: "relative",
        }}
      ></div>

      {/* 버튼 영역 */}
      <div
        style={{
          position: "absolute",
          top: "10px",
          left: "50%", // 가운데 정렬
          transform: "translateX(-50%)", // 가운데 정렬을 위한 변환
          display: "flex",
          gap: "10px",
        }}
      >
        <IconButton id="zoom-in" color="inherit">
          <ZoomInIcon />
        </IconButton>
        <IconButton id="zoom-out" color="inherit">
          <ZoomOutIcon />
        </IconButton>
        <IconButton id="home" color="inherit">
          <HomeIcon />
        </IconButton>
        <IconButton id="full-page" color="inherit">
          <FullscreenIcon />
        </IconButton>
      </div>

      {/* 이미지 정보 */}
      <div
        style={{
          color: "#fff",
          fontSize: "14px",
          position: "absolute",
          bottom: "20px",
          right: "20px",
          backgroundColor: "rgba(0, 0, 0, 0.7)",
          padding: "10px",
          borderRadius: "8px",
          textAlign: "center",
          width: "200px", // 고정된 폭
          overflow: "hidden", // 넘치는 텍스트 숨김
          textOverflow: "ellipsis", // 텍스트 넘칠 경우 '...' 표시
          whiteSpace: "nowrap", // 텍스트 한 줄 유지
        }}
      >
        X: {imageInfo.oriX}px, Y: {imageInfo.oriY}px
        <br />
        Slide: {imageInfo.mmX} {imageInfo.mmXUnit}, {imageInfo.mmY} {imageInfo.mmYUnit}
      </div>
    </div>
  );
}

export default ImageViewer;
