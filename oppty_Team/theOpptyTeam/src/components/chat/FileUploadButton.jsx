// src/components/chat/FileUploadButton.jsx
import React, { useRef, useState } from "react";
import "./FileUpload.css";

export default function FileUploadButton({ onFileSelect, disabled }) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (25MB max)
    if (file.size > 25 * 1024 * 1024) {
      alert("File too large. Maximum size is 25MB");
      return;
    }

    setUploading(true);
    try {
      await onFileSelect(file);
    } catch (err) {
      console.error("Upload error:", err);
      alert("Failed to upload file: " + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <>
      <button
        type="button"
        className="file-upload-btn"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled || uploading}
        title="Attach file"
      >
        {uploading ? "⏳" : "📎"}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        hidden
        onChange={handleFileChange}
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
      />
    </>
  );
}