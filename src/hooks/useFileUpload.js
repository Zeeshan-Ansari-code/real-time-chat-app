import { useState, useRef } from "react";
import axios from "axios";

export function useFileUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileSelect = async (event) => {
    const file = event?.target?.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      alert("File size must be less than 50MB");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      // Use axios with onUploadProgress for progress tracking
      const response = await axios.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            // You can emit this progress to parent component if needed
            // For now, we just track it internally
          }
        },
        timeout: 120000, // 2 minutes timeout for large files
      });

      setSelectedFile(response.data);
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        alert("Upload timeout. Please try again with a smaller file.");
      } else {
        alert("Failed to upload file");
      }
    } finally {
      setIsUploading(false);
    }
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return {
    isUploading,
    selectedFile,
    fileInputRef,
    handleFileSelect,
    removeSelectedFile,
    formatFileSize,
    setSelectedFile
  };
}

