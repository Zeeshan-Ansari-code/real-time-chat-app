import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export const config = {
  api: {
    bodyParser: false,
  },
};

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
      filter: ({ mimetype }) => {
        // Allow common file types
        const allowedTypes = [
          // Images
          'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
          // Videos
          'video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov',
          // Audio
          'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/aac',
          // Documents
          'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/plain', 'text/csv'
        ];
        return allowedTypes.includes(mimetype);
      }
    });

    return new Promise((resolve, reject) => {
      form.parse(req, async (err, fields, files) => {
        if (err) {
          console.error('❌ File upload error:', err);
          reject(res.status(500).json({ error: 'File upload failed' }));
          return;
        }

        const file = files.file;
        if (!file) {
          reject(res.status(400).json({ error: 'No file provided' }));
          return;
        }

        // Debug logging to see file structure
        console.log('File object:', JSON.stringify(file, null, 2));
        console.log('File keys:', Object.keys(file));

        // In formidable v2, the file structure is more straightforward
        const filePath = file.filepath || file.path;
        if (!filePath) {
          console.error('❌ No valid file path found in file object');
          reject(res.status(500).json({ error: 'Invalid file object - no file path' }));
          return;
        }

        // Determine file type based on mimetype with fallback
        let fileType = 'other';
        let mimetype = file.mimetype || file.type || 'application/octet-stream';
        
        try {
          if (mimetype.startsWith('image/')) fileType = 'image';
          else if (mimetype.startsWith('video/')) fileType = 'video';
          else if (mimetype.startsWith('audio/')) fileType = 'audio';
          else if (mimetype.startsWith('application/') || mimetype.startsWith('text/')) fileType = 'document';
        } catch (error) {
          console.log('Error determining file type, using fallback:', error);
          // Fallback: try to determine type from file extension
          const ext = path.extname(file.originalFilename || '').toLowerCase();
          if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext)) fileType = 'image';
          else if (['.mp4', '.webm', '.ogg', '.avi', '.mov'].includes(ext)) fileType = 'video';
          else if (['.mp3', '.wav', '.ogg', '.m4a', '.aac'].includes(ext)) fileType = 'audio';
          else if (['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv'].includes(ext)) fileType = 'document';
        }

        // Generate unique filename and move file
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
          console.error('❌ Error moving file:', moveError);
          console.error('Source path:', filePath);
          console.error('Destination path:', newPath);
          reject(res.status(500).json({ error: 'Failed to save file' }));
        }
      });
    });
  } catch (error) {
    console.error('❌ Upload handler error:', error);
    return res.status(500).json({ error: 'Server error during upload' });
  }
}
