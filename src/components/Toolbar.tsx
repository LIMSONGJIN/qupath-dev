import React from "react";
import { IconButton } from "@mui/material";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import HomeIcon from "@mui/icons-material/Home";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import { ToolbarProps } from "../types/toolbar";


const Toolbar: React.FC<ToolbarProps> = ({ viewer }) => {
  return (
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
      <IconButton onClick={() => viewer.viewport.zoomBy(1.2).applyConstraints()} color="primary">
        <ZoomInIcon />
      </IconButton>
      <IconButton onClick={() => viewer.viewport.zoomBy(0.8).applyConstraints()} color="primary">
        <ZoomOutIcon />
      </IconButton>
      <IconButton onClick={() => viewer.viewport.goHome()} color="primary">
        <HomeIcon />
      </IconButton>
      <IconButton onClick={() => viewer.setFullScreen(!viewer.isFullPage())} color="primary">
        <FullscreenIcon />
      </IconButton>
    </div>
  );
};

export default Toolbar;
