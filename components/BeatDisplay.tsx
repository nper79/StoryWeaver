import React, { useState, useEffect } from 'react';
import { Beat } from '../types';
import { getImageFromStorage } from '../fileStorageService';

interface BeatDisplayProps {
  beat: Beat;
  isLast: boolean;
  onImageGenerate?: (beatId: string) => void;
  onImageRegenerate?: (beatId: string) => void;
  onVideoUpload?: (beatId: string, videoFile: File) => void;
  onBeatUpdate?: (beatId: string, updates: Partial<Beat>) => void;
  generatingImage?: boolean;
}

const BeatDisplay: React.FC<BeatDisplayProps> = ({ 
  beat, 
  isLast, 
  onImageGenerate, 
  onImageRegenerate,
  onVideoUpload,
  onBeatUpdate,
  generatingImage = false 
}) => {
  const [imageLoading, setImageLoading] = useState(false);
  const [storedImage, setStoredImage] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [storedVideo, setStoredVideo] = useState<string | null>(null);
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState(beat.imagePrompt || '');
  const [isImageMaximized, setIsImageMaximized] = useState(false);

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

  // Sync editedPrompt when beat.imagePrompt changes
  useEffect(() => {
    if (!isEditingPrompt) {
      setEditedPrompt(beat.imagePrompt || '');
    }
  }, [beat.imagePrompt, isEditingPrompt]);

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
                className="w-full h-48 object-cover rounded-lg border border-slate-600 cursor-pointer"
                onClick={() => setIsImageMaximized(true)}
                title="Click to maximize image"
              />
            )}
            {/* Image overlay with regenerate and video upload options */}
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 rounded-lg flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsImageMaximized(true);
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md text-sm transition-all duration-200"
                  title="Maximize image"
                >
                  🔍 Maximize
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onImageRegenerate?.(beat.id);
                  }}
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
          <div className="flex items-start justify-between gap-3">
            <p className="text-slate-200 leading-relaxed whitespace-pre-line flex-grow">
              {beat.text.replace(/\[[^\]]+\]/g, '').trim()}
            </p>
            {/* Show remove annotations button only if text contains speaker annotations */}
            {beat.text.includes('[') && beat.text.includes(']') && (
              <button
                onClick={() => {
                  const cleanText = beat.text.replace(/\[[^\]]+\]/g, '').trim();
                  onBeatUpdate?.(beat.id, { text: cleanText });
                }}
                className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded transition-colors shrink-0"
                title="Remove speaker annotations permanently"
              >
                🗑️ Remove Annotations
              </button>
            )}
          </div>
        </div>

        {/* Image prompt display (editable) */}
        {beat.imagePrompt && (
          <details className="mt-2">
            <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-300 flex items-center gap-2">
              <span>▼ Image Prompt</span>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (isEditingPrompt) {
                    // Save the edited prompt
                    onBeatUpdate?.(beat.id, { imagePrompt: editedPrompt });
                    setIsEditingPrompt(false);
                  } else {
                    // Start editing
                    setEditedPrompt(beat.imagePrompt || '');
                    setIsEditingPrompt(true);
                  }
                }}
                className="text-xs px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                title={isEditingPrompt ? 'Save changes' : 'Edit prompt'}
              >
                {isEditingPrompt ? '💾 Save' : '✏️ Edit'}
              </button>
            </summary>
            <div className="mt-1 p-2 bg-slate-900 border border-slate-700 rounded text-xs">
              {isEditingPrompt ? (
                <textarea
                  value={editedPrompt}
                  onChange={(e) => setEditedPrompt(e.target.value)}
                  className="w-full h-20 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-300 text-xs resize-none focus:outline-none focus:border-blue-500"
                  placeholder="Enter image prompt..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.ctrlKey) {
                      // Save on Ctrl+Enter
                      onBeatUpdate?.(beat.id, { imagePrompt: editedPrompt });
                      setIsEditingPrompt(false);
                    } else if (e.key === 'Escape') {
                      // Cancel on Escape
                      setEditedPrompt(beat.imagePrompt || '');
                      setIsEditingPrompt(false);
                    }
                  }}
                />
              ) : (
                <div className="text-slate-400 whitespace-pre-wrap">
                  {beat.imagePrompt}
                </div>
              )}
              {isEditingPrompt && (
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => {
                      onBeatUpdate?.(beat.id, { imagePrompt: editedPrompt });
                      setIsEditingPrompt(false);
                    }}
                    className="text-xs px-2 py-1 rounded bg-green-600 hover:bg-green-700 text-white transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setEditedPrompt(beat.imagePrompt || '');
                      setIsEditingPrompt(false);
                    }}
                    className="text-xs px-2 py-1 rounded bg-gray-600 hover:bg-gray-700 text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <div className="text-xs text-slate-500 flex items-center ml-auto">
                    Ctrl+Enter to save, Esc to cancel
                  </div>
                </div>
              )}
            </div>
          </details>
        )}
      </div>

      {/* Image Maximization Modal */}
      {isImageMaximized && storedImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
          onClick={() => setIsImageMaximized(false)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh] p-4">
            <img 
              src={storedImage}
              alt={`Beat ${beat.order + 1} visual - Maximized`}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setIsImageMaximized(false)}
              className="absolute top-2 right-2 bg-black bg-opacity-50 hover:bg-opacity-75 text-white rounded-full p-2 transition-all duration-200"
              title="Close maximized view"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-3 py-1 rounded-lg text-sm">
              Beat {beat.order + 1}
            </div>
          </div>
        </div>
      )}

      {/* Separator line (except for last beat) */}
      {!isLast && (
        <div className="mt-4 border-b border-slate-600 opacity-50"></div>
      )}
    </div>
  );
};

export default BeatDisplay;
