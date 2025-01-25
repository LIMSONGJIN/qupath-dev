import React from "react";

function ClassManager() {
  const classes = [
    { id: 0, name: "Unclassified", color: "#FF0000", count: 0 },
    { id: 1, name: "Class 1", color: "#0072B2", count: 5 },
  ];

  return (
    <div className="class-manager">
      {classes.map((cls) => (
        <div key={cls.id} style={{ color: cls.color }}>
          {cls.name} ({cls.count})
        </div>
      ))}
    </div>
  );
}

export default ClassManager;
