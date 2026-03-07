const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');

// Configure Cloudinary from environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Use memory storage — file buffer is streamed to Cloudinary manually
const materialFileFilter = (req, file, cb) => {
  const allowed = [
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/webm',
    'application/pdf'
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only video files (MP4, MOV, AVI, WebM) and PDF files are allowed'), false);
  }
};

// Max file size: Cloudinary free plan = 10 MB. Override via CLOUDINARY_MAX_MB env var after upgrading plan.
const MAX_FILE_BYTES = (parseInt(process.env.CLOUDINARY_MAX_MB) || 10) * 1024 * 1024;

// Multer limit matches Cloudinary free plan (10 MB); holds file in memory buffer
const uploadMaterial = multer({
  storage: multer.memoryStorage(),
  fileFilter: materialFileFilter,
  limits: { fileSize: MAX_FILE_BYTES }
}).single('file');

// Upload an in-memory buffer to Cloudinary and return { url, publicId, bytes }
function uploadBufferToCloudinary(buffer, mimetype) {
  return new Promise((resolve, reject) => {
    const isVideo = mimetype.startsWith('video/');
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'skillexchange/materials',
        resource_type: isVideo ? 'video' : 'raw',
        ...(isVideo && { transformation: [{ quality: 'auto' }] })
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          bytes: result.bytes || 0
        });
      }
    );
    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);
    readable.pipe(uploadStream);
  });
}

module.exports = { cloudinary, uploadMaterial, uploadBufferToCloudinary, MAX_FILE_BYTES };
