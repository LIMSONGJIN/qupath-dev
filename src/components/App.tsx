import { useEffect, useState } from "react";
import ImageList from "./ImageList";
import ImageViewer from "./ImageViewer";
import ClassManager from "./ClassManager";
import { ImageInfo, Annotation } from "../types/app";

function App() {
  const [selectedImage, setSelectedImage] = useState<string>("");
  const [selectedImageName, setSelectedImageName] = useState<string>("이미지를 선택하세요");
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);

  // 이미지 선택 이벤트 핸들러
  const handleImageSelect = (image: string, name: string) => {
    setSelectedImage(image);
    setSelectedImageName(name);
    // 선택한 이미지 정보를 로컬 스토리지에 저장
    localStorage.setItem("selectedImage", image);
    localStorage.setItem("selectedImageName", name);

    // 해당 이미지에 대한 annotation 데이터 로드
    fetch(`/annotations/${name.split(".")[0]}_annotation.json`)
      .then((response) => response.json())
      .then((data) => {
        setAnnotations(data.annotations || []);
      })
      .catch((error) => {
        console.error("Error loading annotations:", error);
        setAnnotations([]); // 실패 시 빈 배열로 설정
      });
  };

  // 단축키 이벤트 핸들러 추가
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (images.length === 0) return;

      const currentIndex = images.findIndex((img) => img.url === selectedImage);

      if (e.key === "z" || e.key === "Z") {
        // 이전 이미지
        const prevIndex = (currentIndex === 0 ? images.length : currentIndex) - 1;
        handleImageSelect(images[prevIndex].url, images[prevIndex].name);
      } else if (e.key === "x" || e.key === "X") {
        // 다음 이미지
        const nextIndex = (currentIndex + 1) % images.length;
        handleImageSelect(images[nextIndex].url, images[nextIndex].name);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [selectedImage, images]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", width: "100vw", overflow: "hidden" }}>
      <div style={{ padding: "10px", backgroundColor: "#f8f9fa", borderBottom: "1px solid #ddd", textAlign: "center" }}>
        <h3 style={{ margin: 0 }}>{selectedImageName}</h3>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div style={{ width: "350px", backgroundColor: "#f4f4f4", borderRight: "1px solid #ccc", overflowY: "auto", padding: "10px" }}>
          <ImageList onImageSelect={handleImageSelect} selectedImage={selectedImage} setImages={setImages} />
        </div>

        <div style={{ flex: 2, backgroundColor: "#000", position: "relative", overflow: "hidden" }}>
          {selectedImage ? (
            <ImageViewer imageUrl={selectedImage} annotations={annotations} setAnnotations={setAnnotations}/>
          ) : (
            <div style={{ color: "white", textAlign: "center", marginTop: "20px" }}>이미지를 선택하세요</div>
          )}
        </div>

        <div style={{ width: "250px", backgroundColor: "#f8f9fa", borderLeft: "1px solid #ccc", padding: "10px", overflowY: "auto" }}>
          <ClassManager selectedImageName={selectedImageName} />
        </div>
      </div>
    </div>
  );
}

export default App;
