import React, { useEffect } from "react";
import OpenSeadragon from "openseadragon";

interface ViewerSetupProps {
  imageUrl: string;
  viewerRef: React.MutableRefObject<OpenSeadragon.Viewer | null>;
  setIsViewerReady: (ready: boolean) => void;
  setImageWidth: (width: number) => void;
  setIsToolbarVisible: (visible: boolean) => void;
}

const ViewerSetup: React.FC<ViewerSetupProps> = ({
  imageUrl,
  viewerRef,
  setIsViewerReady,
  setImageWidth,
  setIsToolbarVisible,
}) => {
  const hideTimerRef = React.useRef<number | null>(null);

  useEffect(() => {
    if (!viewerRef.current) {
      const viewer = OpenSeadragon({
        element: document.getElementById("openseadragon") as HTMLElement,
        tileSources: {
          type: "image",
          url: imageUrl,
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

  return <div id="openseadragon" style={{ width: "100%", height: "100%", position: "relative" }}></div>;
};

export default ViewerSetup;
