// src/components/chat/FilePreview.jsx
import React from "react";
import "./FileUpload.css";

export default function FilePreview({ message }) {
  const { messageType, fileUrl, fileName, fileSize } = message;

  const formatFileSize = (bytes) => {
    if (!bytes) return "";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const getFileIcon = () => {
    if (!fileName) return "📄";
    const ext = fileName.split('.').pop()?.toLowerCase();
    const icons = {
      pdf: "📕",
      doc: "📘", docx: "📘",
      xls: "📗", xlsx: "📗",
      ppt: "📙", pptx: "📙",
      zip: "📦", rar: "📦",
      txt: "📝",
      mp3: "🎵", wav: "🎵",
      mp4: "🎬", mov: "🎬", avi: "🎬",
    };
    return icons[ext] || "📄";
  };

  if (messageType === "image") {
    return (
      <div className="file-preview-image">
        <img 
          src={fileUrl} 
          alt={fileName || "Image"} 
          onClick={() => window.open(fileUrl, '_blank')}
        />
      </div>
    );
  }

  if (messageType === "video") {
    return (
      <div className="file-preview-video">
        <video controls src={fileUrl} />
      </div>
    );
  }

  if (messageType === "audio") {
    return (
      <div className="file-preview-audio">
        <audio controls src={fileUrl} />
      </div>
    );
  }

  // Generic file
  return (
    <a 
      href={fileUrl} 
      target="_blank" 
      rel="noopener noreferrer" 
      className="file-preview-generic"
      download={fileName}
    >
      <span className="file-icon">{getFileIcon()}</span>
      <div className="file-info">
        <div className="file-name">{fileName || "File"}</div>
        {fileSize && <div className="file-size">{formatFileSize(fileSize)}</div>}
      </div>
      <span className="file-download">⬇️</span>
    </a>
  );
}