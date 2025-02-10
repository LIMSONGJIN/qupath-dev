import React, { useState, useRef } from "react";
import ViewerSetup from "./ViewerSetup";
import AnnotationRenderer from "./AnnotationRenderer";
import Toolbar from "./Toolbar";
import Scalebar from "./ScaleBar";
import OpenSeadragon from "openseadragon";

interface Annotation {
  id: string;
  bbox: [number, number, number, number];
  class: string;
}

interface ImageViewerProps {
  imageUrl: string;
  annotations: Annotation[];
}

const ImageViewer: React.FC<ImageViewerProps> = ({ imageUrl, annotations }) => {
  const viewerRef = useRef<OpenSeadragon.Viewer | null>(null);
  const [isViewerReady, setIsViewerReady] = useState(false);
  const [imageWidth, setImageWidth] = useState(0);
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);
  const [selectedSide, setSelectedSide] = useState<{ id: string; side: string } | null>(null);
  const [isToolbarVisible, setIsToolbarVisible] = useState(true);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <ViewerSetup
        imageUrl={imageUrl}
        viewerRef={viewerRef}
        setIsViewerReady={setIsViewerReady}
        setImageWidth={setImageWidth}
        setIsToolbarVisible={setIsToolbarVisible}
      />

      {isViewerReady && (
        <>
          <AnnotationRenderer
            annotations={annotations}
            viewer={viewerRef.current!}
            selectedAnnotation={selectedAnnotation}
            setSelectedAnnotation={setSelectedAnnotation}
            selectedSide={selectedSide}             
            setSelectedSide={setSelectedSide}       
          />
          <Scalebar
            viewer={viewerRef.current!}
            minWidthPx={200}
            location="BOTTOM_RIGHT"
            color="red"
            fontColor="white"
            backgroundColor="rgba(0, 0, 0, 0.7)"
            fontSize="14px"
            barThickness={6}
            imageWidth={imageWidth}
          />
          {isToolbarVisible && <Toolbar viewer={viewerRef.current!} />}
        </>
      )}
    </div>
  );
};

export default ImageViewer;
