/**
 * Client-side Cloudinary upload utility
 * This bypasses Vercel's 10-second timeout by uploading directly from the browser
 */

export async function uploadToCloudinary(file, fileType = 'auto', onProgress = null) {
  // Check if Cloudinary is configured
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error('Cloudinary not configured. Please set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET');
  }

  // Determine resource type
  let resourceType = 'auto';
  if (fileType === 'image') {
    resourceType = 'image';
  } else if (fileType === 'video') {
    resourceType = 'video';
  } else if (fileType === 'voice' || fileType === 'audio') {
    resourceType = 'raw';
  } else if (fileType === 'document') {
    resourceType = 'raw';
  }

  // Create form data
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);
  formData.append('folder', 'chat-uploads');
  formData.append('resource_type', resourceType);

  // Add optimization for images
  if (resourceType === 'image') {
    formData.append('quality', 'auto');
    formData.append('fetch_format', 'auto');
  }

  // Upload to Cloudinary
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // Track upload progress
    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          onProgress(percentComplete);
        }
      });
    }

    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve({
            fileUrl: response.secure_url,
            publicId: response.public_id,
            bytes: response.bytes,
            format: response.format,
            width: response.width,
            height: response.height,
          });
        } catch (error) {
          reject(new Error('Failed to parse Cloudinary response'));
        }
      } else {
        try {
          const error = JSON.parse(xhr.responseText);
          reject(new Error(error.error?.message || 'Upload failed'));
        } catch {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload cancelled'));
    });

    // Set timeout (60 seconds for client-side uploads)
    xhr.timeout = 60000;
    xhr.addEventListener('timeout', () => {
      reject(new Error('Upload timeout'));
    });

    xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`);
    xhr.send(formData);
  });
}

