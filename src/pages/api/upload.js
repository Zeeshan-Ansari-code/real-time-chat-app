import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { v2 as cloudinary } from 'cloudinary';

export const config = {
  api: {
    bodyParser: false,
  },
};

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Ensure uploads directory exists
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Formidable v2 syntax
    const form = formidable({
      uploadDir: uploadsDir,
      keepExtensions: true,
      maxFileSize: 50 * 1024 * 1024, // 50MB limit
      allowEmptyFiles: false,
      multiples: false,
        filter: ({ mimetype, name }) => {
        // Allow common file types
        const allowedTypes = [
          // Images
          'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
          // Videos
          'video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov',
          // Audio (including webm audio from MediaRecorder)
          'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/aac', 'audio/webm',
          // Documents
          'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/plain', 'text/csv'
        ];
        
        // If no mimetype, check file extension (for Blob files from MediaRecorder)
        if (!mimetype && name) {
          const ext = name.toLowerCase();
          if (ext.endsWith('.webm') || ext.endsWith('.mp3') || ext.endsWith('.wav') || ext.endsWith('.ogg') || ext.endsWith('.m4a') || ext.endsWith('.aac')) {
            return true; // Allow audio files by extension
          }
          if (ext.endsWith('.jpg') || ext.endsWith('.jpeg') || ext.endsWith('.png') || ext.endsWith('.gif') || ext.endsWith('.webp') || ext.endsWith('.svg')) {
            return true; // Allow image files by extension
          }
          if (ext.endsWith('.mp4') || ext.endsWith('.webm') || ext.endsWith('.ogg') || ext.endsWith('.avi') || ext.endsWith('.mov')) {
            return true; // Allow video files by extension
          }
          if (ext.endsWith('.pdf') || ext.endsWith('.doc') || ext.endsWith('.docx') || ext.endsWith('.xls') || ext.endsWith('.xlsx') || ext.endsWith('.txt') || ext.endsWith('.csv')) {
            return true; // Allow document files by extension
          }
        }
        
        return !mimetype || allowedTypes.includes(mimetype);
      }
    });

    return new Promise((resolve, reject) => {
      form.parse(req, async (err, fields, files) => {
        if (err) {
          console.error('Formidable parse error:', err);
          reject(res.status(500).json({ error: 'File upload failed', details: err.message }));
          return;
        }

        // Debug: log what we received
        console.log('Files received:', Object.keys(files));
        console.log('Fields received:', fields);

        // In formidable v2, files can be an array even with multiples: false
        let file = files.file;
        if (Array.isArray(file)) {
          file = file[0];
        }
        
        // Also check if file is in files array directly
        if (!file && Array.isArray(files) && files.length > 0) {
          file = files[0];
        }
        
        if (!file) {
          console.error('No file found in:', files);
          reject(res.status(400).json({ error: 'No file provided', received: Object.keys(files) }));
          return;
        }

        // In formidable v2, the file structure is more straightforward
        const filePath = file.filepath || file.path;
        if (!filePath) {
          reject(res.status(500).json({ error: 'Invalid file object - no file path' }));
          return;
        }

        // Determine file type based on mimetype with fallback
        let fileType = 'other';
        let mimetype = file.mimetype || file.type || 'application/octet-stream';
        
        // Check if fileType was passed in fields (for voice messages)
        let requestedFileType = fields.fileType;
        if (Array.isArray(requestedFileType)) {
          requestedFileType = requestedFileType[0];
        }
        
        if (requestedFileType && ['image', 'video', 'audio', 'document', 'voice', 'other'].includes(requestedFileType)) {
          fileType = requestedFileType === 'voice' ? 'voice' : requestedFileType;
        } else {
          // Try to determine from mimetype
          try {
            if (mimetype.startsWith('image/')) fileType = 'image';
            else if (mimetype.startsWith('video/')) fileType = 'video';
            else if (mimetype.startsWith('audio/')) fileType = 'voice'; // Voice messages are audio
            else if (mimetype.startsWith('application/') || mimetype.startsWith('text/')) fileType = 'document';
          } catch (error) {
            // Fallback: try to determine type from file extension
            const ext = path.extname(file.originalFilename || file.name || '').toLowerCase();
            if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext)) fileType = 'image';
            else if (['.mp4', '.webm', '.ogg', '.avi', '.mov'].includes(ext)) fileType = 'video';
            else if (['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.webm'].includes(ext)) fileType = 'voice'; // Voice messages
            else if (['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv'].includes(ext)) fileType = 'document';
          }
        }

        // Upload to Cloudinary if configured, otherwise use local storage
        const useCloudinary = process.env.CLOUDINARY_CLOUD_NAME && 
                              process.env.CLOUDINARY_API_KEY && 
                              process.env.CLOUDINARY_API_SECRET;

        if (useCloudinary) {
          try {
            // Upload to Cloudinary
            // Determine resource type: video, image, or raw (for audio/documents)
            let resourceType = 'raw';
            if (fileType === 'video') {
              resourceType = 'video';
            } else if (fileType === 'image') {
              resourceType = 'image';
            } else {
              // For voice messages (audio) and documents, use 'raw'
              resourceType = 'raw';
            }
            
            const uploadResult = await cloudinary.uploader.upload(filePath, {
              resource_type: resourceType,
              folder: 'chat-uploads',
              use_filename: false,
              unique_filename: true,
              overwrite: false,
            });

            // Delete local file after successful upload
            try {
              fs.unlinkSync(filePath);
            } catch (unlinkError) {
              console.warn('Failed to delete local file after Cloudinary upload:', unlinkError);
            }

            // Return file info with Cloudinary URL
            resolve(res.status(200).json({
              fileType,
              fileName: file.originalFilename || 'Unknown file',
              fileUrl: uploadResult.secure_url,
              fileSize: file.size || uploadResult.bytes || 0,
              mimetype: mimetype
            }));
          } catch (cloudinaryError) {
            console.error('Cloudinary upload error:', cloudinaryError);
            // Fallback to local storage if Cloudinary fails
            const ext = path.extname(file.originalFilename || '');
            const filename = `${uuidv4()}${ext}`;
            const newPath = path.join(uploadsDir, filename);
            fs.renameSync(filePath, newPath);
            
            resolve(res.status(200).json({
              fileType,
              fileName: file.originalFilename || 'Unknown file',
              fileUrl: `/uploads/${filename}`,
              fileSize: file.size || 0,
              mimetype: mimetype
            }));
          }
        } else {
          // Use local storage (fallback or development)
          const ext = path.extname(file.originalFilename || '');
          const filename = `${uuidv4()}${ext}`;
          const newPath = path.join(uploadsDir, filename);

          try {
            // Move file to final location
            fs.renameSync(filePath, newPath);

            // Return file info
            resolve(res.status(200).json({
              fileType,
              fileName: file.originalFilename || 'Unknown file',
              fileUrl: `/uploads/${filename}`,
              fileSize: file.size || 0,
              mimetype: mimetype
            }));
          } catch (moveError) {
            reject(res.status(500).json({ error: 'Failed to save file' }));
          }
        }
      });
    });
  } catch (error) {
    return res.status(500).json({ error: 'Server error during upload' });
  }
}
