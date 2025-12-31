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
      // Determine file type
      let fileType = 'auto';
      if (file.type.startsWith('image/')) {
        fileType = 'image';
      } else if (file.type.startsWith('video/')) {
        fileType = 'video';
      } else if (file.type.startsWith('audio/')) {
        fileType = 'voice';
      } else if (file.type.startsWith('application/') || file.type.startsWith('text/')) {
        fileType = 'document';
      }

      let result;

      // Try client-side Cloudinary upload first (bypasses Vercel timeout)
      try {
        const { uploadToCloudinary } = await import("@/utils/cloudinaryUpload");
        result = await uploadToCloudinary(file, fileType, (progress) => {
          // Progress tracking if needed
        });
        setSelectedFile({
          fileType,
          fileName: file.name,
          fileUrl: result.fileUrl,
          fileSize: result.bytes || file.size,
          mimetype: file.type,
        });
      } catch (cloudinaryError) {
        console.warn('Client-side Cloudinary upload failed, trying server-side:', cloudinaryError);
        // Fallback to server-side upload
        const formData = new FormData();
        formData.append('file', file);
        const response = await axios.post('/api/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 9000,
        });
        setSelectedFile(response.data);
      }
    } catch (error) {
      console.error('Upload error:', error);
      if (error.code === 'ECONNABORTED') {
        alert("Upload timeout. Please try again with a smaller file or configure Cloudinary client-side uploads.");
      } else {
        alert(error.message || "Failed to upload file. Please check Cloudinary configuration.");
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

