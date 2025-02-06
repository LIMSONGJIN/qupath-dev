import React, { useEffect, useState } from "react";

interface ClassInfo {
  id: number;
  name: string;
  color: string;
  count: number;
}

interface ClassManagerProps {
  selectedImageName: string;
}

// 기본 클래스 목록
const defaultClasses: ClassInfo[] = [
  { id: 0, name: "Unclassified", color: "#FF0000", count: 0 },
  { id: 1, name: "Class 1", color: "#0072B2", count: 0 },
  { id: 2, name: "Class 2", color: "#56B4E9", count: 0 },
  { id: 3, name: "Class 3", color: "#90EE90", count: 0 },
  { id: 4, name: "Class 4", color: "#009E73", count: 0 },
  { id: 5, name: "Class 5", color: "#E69F00", count: 0 },
  { id: 6, name: "Class 6", color: "#D55E00", count: 0 },
  { id: 7, name: "Class 7", color: "#CC79A7", count: 0 },
  { id: 8, name: "Class 8", color: "#4B0082", count: 0 },
  { id: 9, name: "Class 9", color: "#CCCCCC", count: 0 },
];

const ClassManager: React.FC<ClassManagerProps> = ({ selectedImageName }) => {
  const [classes, setClasses] = useState<ClassInfo[]>(defaultClasses);

  useEffect(() => {
    if (!selectedImageName) return;

    const jsonFilePath = `/public/annotations/${selectedImageName.replace(".png", "_annotation.json")}`;

    const loadAnnotations = async () => {
      try {
        const response = await fetch(jsonFilePath);
        const data = await response.json();

        // annotations 배열에서 클래스별 개수 계산
        const classCounts: Record<string, number> = {};
        data.annotations.forEach((annotation: any) => {
          const className = annotation.class || "Unclassified";
          classCounts[className] = (classCounts[className] || 0) + 1;
        });

        // 기본 클래스 목록을 기반으로 개수를 업데이트
        const updatedClasses = defaultClasses.map((cls) => ({
          ...cls,
          count: classCounts[cls.name] || 0, // 해당 클래스가 없으면 0으로 표시
        }));

        setClasses(updatedClasses);
      } catch (error) {
        console.error("Failed to load annotation JSON:", error);
      }
    };

    loadAnnotations();
  }, [selectedImageName]);

  return (
    <div style={{ padding: "10px", backgroundColor: "#222", color: "#fff", borderRadius: "8px" }}>
      <h3 style={{ marginBottom: "10px", textAlign: "center" }}>View Control</h3>
      {classes.map((cls) => (
        <div key={cls.id} style={{ display: "flex", alignItems: "center", marginBottom: "10px" }}>
          <div
            style={{
              width: "20px",
              height: "20px",
              backgroundColor: cls.color,
              borderRadius: "4px",
              marginRight: "10px",
            }}
          ></div>
          <span>{cls.name}</span>
          <span style={{ marginLeft: "auto", fontWeight: "bold" }}>{cls.count}</span>
        </div>
      ))}
    </div>
  );
};

export default ClassManager;
