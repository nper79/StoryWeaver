import React, { useState, useEffect } from 'react';
import { Beat } from '../types';
import { getImageFromStorage } from '../fileStorageService';

interface BeatDisplayProps {
  beat: Beat;
  isLast: boolean;
  onImageGenerate?: (beatId: string) => void;
  onImageRegenerate?: (beatId: string) => void;
  onVideoUpload?: (beatId: string, videoFile: File) => void;
  generatingImage?: boolean;
}

const BeatDisplay: React.FC<BeatDisplayProps> = ({ 
  beat, 
  isLast, 
  onImageGenerate, 
  onImageRegenerate,
  onVideoUpload,
  generatingImage = false 
}) => {
  const [imageLoading, setImageLoading] = useState(false);
  const [storedImage, setStoredImage] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [storedVideo, setStoredVideo] = useState<string | null>(null);

  useEffect(() => {
    const loadStoredImage = async () => {
      if (beat.imageId) {
        setImageLoading(true);
        try {
          const imageData = await getImageFromStorage(beat.imageId);
          setStoredImage(imageData);
        } catch (error) {
          console.error(`Error loading image for beat ${beat.id}:`, error);
          setStoredImage(null);
        }
        setImageLoading(false);
      } else {
        setStoredImage(null);
      }
    };
    loadStoredImage();
  }, [beat.imageId, beat.id]);

  useEffect(() => {
    const loadStoredVideo = async () => {
      if (beat.videoId) {
        console.log(`🎬 [BeatDisplay] Loading video for beat ${beat.id} with videoId: ${beat.videoId}`);
        setVideoLoading(true);
        try {
          const videoData = await getImageFromStorage(beat.videoId); // Reuse storage service
          if (videoData) {
            console.log(`🎬 [BeatDisplay] ✅ Video loaded successfully for beat ${beat.id}:`, {
              videoId: beat.videoId,
              dataLength: videoData.length,
              dataType: videoData.substring(0, 30) + '...'
            });
            setStoredVideo(videoData);
          } else {
            console.warn(`🎬 [BeatDisplay] ❌ No video data found for beat ${beat.id} with videoId: ${beat.videoId}`);
            setStoredVideo(null);
          }
        } catch (error) {
          console.error(`🎬 [BeatDisplay] ❌ Error loading video for beat ${beat.id}:`, error);
          setStoredVideo(null);
        }
        setVideoLoading(false);
      } else {
        console.log(`🎬 [BeatDisplay] No videoId for beat ${beat.id}`);
        setStoredVideo(null);
      }
    };
    loadStoredVideo();
  }, [beat.videoId, beat.id]);

  const handleVideoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && onVideoUpload) {
      // Validate file type
      if (!file.type.startsWith('video/')) {
        alert('Please select a valid video file.');
        return;
      }
      
      // Validate file size (max 100MB)
      if (file.size > 100 * 1024 * 1024) {
        alert('Video file is too large. Please select a file smaller than 100MB.');
        return;
      }
      
      onVideoUpload(beat.id, file);
    }
    // Clear the input
    event.target.value = '';
  };
  return (
    <div className="beat-container mb-4 last:mb-0">
      {/* Video/Image Section */}
      <div className="beat-media-container mb-3 relative">
        {/* Show video if available, otherwise show image */}
        {beat.videoId && storedVideo ? (
          <div className="relative group">
            {videoLoading ? (
              <div className="w-full h-48 bg-slate-700 border border-slate-600 rounded-lg flex items-center justify-center">
                <span className="text-slate-400 text-sm">Loading video...</span>
              </div>
            ) : (
              <video 
                src={storedVideo}
                className="w-full h-48 object-cover rounded-lg border border-slate-600"
                controls={false}
                autoPlay
                muted
                loop
                playsInline
                onLoadedData={() => console.log(`🎬 [BeatDisplay] Video element loaded and ready to play`)}
                onError={(e) => console.error(`🎬 [BeatDisplay] Video playback error:`, e)}
              />
            )}
            {/* Video overlay with upload option */}
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 rounded-lg flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 flex gap-2">
                <label className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded-md text-sm transition-all duration-200 cursor-pointer">
                  Replace Video
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleVideoUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>
        ) : beat.imageId && storedImage ? (
          <div className="relative group">
            {imageLoading ? (
              <div className="w-full h-48 bg-slate-700 border border-slate-600 rounded-lg flex items-center justify-center">
                <span className="text-slate-400 text-sm">Loading image...</span>
              </div>
            ) : (
              <img 
                src={storedImage}
                alt={`Beat ${beat.order + 1} visual`}
                className="w-full h-48 object-cover rounded-lg border border-slate-600"
              />
            )}
            {/* Image overlay with regenerate and video upload options */}
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 rounded-lg flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 flex gap-2">
                <button
                  onClick={() => onImageRegenerate?.(beat.id)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md text-sm transition-all duration-200"
                  disabled={generatingImage}
                >
                  {generatingImage ? 'Generating...' : 'Regenerate Image'}
                </button>
                <label className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded-md text-sm transition-all duration-200 cursor-pointer">
                  🎥 Upload Video
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleVideoUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full h-48 bg-slate-700 border border-slate-600 rounded-lg flex items-center justify-center">
            {generatingImage ? (
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-2"></div>
                <p className="text-slate-400 text-sm">Generating image...</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => onImageGenerate?.(beat.id)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
                >
                  Generate Image
                </button>
                <label className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md transition-colors cursor-pointer text-center">
                  🎥 Upload Video
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleVideoUpload}
                    className="hidden"
                  />
                </label>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Text Section */}
      <div className="beat-text-container">
        <div className="beat-text bg-slate-800 border border-slate-600 rounded-lg p-4">
          <p className="text-slate-200 leading-relaxed whitespace-pre-line">
            {beat.text.replace(/\[[^\]]+\]/g, '').trim()}
          </p>
        </div>

        {/* Image prompt display (for debugging/editing) */}
        {beat.imagePrompt && (
          <details className="mt-2">
            <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-300">
              Image Prompt
            </summary>
            <div className="mt-1 p-2 bg-slate-900 border border-slate-700 rounded text-xs text-slate-400">
              {beat.imagePrompt}
            </div>
          </details>
        )}
      </div>

      {/* Separator line (except for last beat) */}
      {!isLast && (
        <div className="mt-4 border-b border-slate-600 opacity-50"></div>
      )}
    </div>
  );
};

export default BeatDisplay;
