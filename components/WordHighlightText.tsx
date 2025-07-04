import React, { useState, useEffect } from 'react';

interface WordTimestamp {
  word: string;
  start_time_ms: number;
  end_time_ms: number;
}

interface WordHighlightTextProps {
  text: string;
  isPlaying: boolean;
  audioDuration: number;
  currentTime: number;
  speaker?: string;
  className?: string;
  wordTimestamps?: WordTimestamp[];
}

const WordHighlightText: React.FC<WordHighlightTextProps> = ({
  text,
  isPlaying,
  audioDuration,
  currentTime,
  speaker,
  className = '',
  wordTimestamps
}) => {
  const [words, setWords] = useState<string[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState<number>(-1);
  const [isAutoProgressing, setIsAutoProgressing] = useState(false);

  // Debug logging
  console.log('🎯 [WordHighlightText] Render:', {
    text: text?.substring(0, 50) + '...',
    isPlaying,
    audioDuration,
    currentTime,
    speaker,
    wordsLength: words.length,
    currentWordIndex,
    isAutoProgressing
  });

  // Parse text into words
  useEffect(() => {
    if (!text) {
      setWords([]);
      return;
    }

    // Split text into words, preserving punctuation
    const wordList = text.split(/(\s+)/).filter(word => word.trim().length > 0);
    setWords(wordList);
    setCurrentWordIndex(-1); // Reset highlighting
    
    console.log(` [WordHighlight] Parsed ${wordList.length} words from text`);
  }, [text]);

  // Ultra-precise millisecond-level word highlighting using multiple timing sources
  useEffect(() => {
    if (!isPlaying || words.length === 0 || audioDuration <= 0) {
      console.log(`🎯 [WordHighlight] Not updating - isPlaying: ${isPlaying}, words: ${words.length}, duration: ${audioDuration}`);
      setCurrentWordIndex(-1);
      setIsAutoProgressing(false);
      return;
    }

    console.log(`⚡ [WordHighlight] Starting ULTRA-PRECISE millisecond highlighting`);
    setIsAutoProgressing(true);
    
    let animationFrameId: number;
    let startTime: number | null = null;
    let audioStartTime: number | null = null;
    
    // Predictive compensation - anticipate highlighting by this amount
    const PREDICTION_OFFSET_MS = 75; // Anticipate by 75ms for smoother perception
    const CALIBRATION_SAMPLES = 10;
    let latencyMeasurements: number[] = [];
    
    const updateWordHighlight = (timestamp: number) => {
      // Initialize timing references
      if (!startTime) {
        startTime = timestamp;
        console.log(`🎯 [WordHighlight] Initialized high-res timer at ${timestamp.toFixed(3)}ms`);
      }
      
      // Get multiple timing sources for maximum precision
      const audioElement = document.querySelector('audio') as HTMLAudioElement;
      const performanceTime = performance.now();
      const audioCurrentTime = audioElement ? audioElement.currentTime : currentTime;
      
      // Initialize audio start time reference
      if (!audioStartTime && audioElement && audioElement.currentTime > 0) {
        audioStartTime = performanceTime - (audioElement.currentTime * 1000);
        console.log(`🎯 [WordHighlight] Audio start time calibrated: ${audioStartTime.toFixed(3)}ms`);
      }
      
      // Calculate ultra-precise timing with multiple sources
      let preciseAudioTime: number;
      if (audioStartTime && audioElement) {
        // Use performance.now() for microsecond precision
        const elapsedMs = performanceTime - audioStartTime;
        preciseAudioTime = elapsedMs / 1000;
        
        // Cross-validate with audio.currentTime
        const audioDiff = Math.abs(preciseAudioTime - audioElement.currentTime);
        if (audioDiff > 0.1) { // If difference > 100ms, recalibrate
          audioStartTime = performanceTime - (audioElement.currentTime * 1000);
          preciseAudioTime = audioElement.currentTime;
          console.log(`🔄 [WordHighlight] Recalibrated timing, diff was ${(audioDiff * 1000).toFixed(1)}ms`);
        }
      } else {
        preciseAudioTime = audioCurrentTime;
      }
      
      // Apply predictive compensation
      const compensatedTime = preciseAudioTime + (PREDICTION_OFFSET_MS / 1000);
      
      if (wordTimestamps && wordTimestamps.length > 0) {
        // Ultra-precise timestamp matching
        const currentTimeMs = compensatedTime * 1000;
        let targetWordIndex = 0;
        let bestMatch = -1;
        let minDistance = Infinity;
        
        // Find the most precise word match
        for (let i = 0; i < wordTimestamps.length; i++) {
          const timestamp = wordTimestamps[i];
          const startMs = timestamp.start_time_ms;
          const endMs = timestamp.end_time_ms;
          
          if (currentTimeMs >= startMs && currentTimeMs <= endMs) {
            // Direct hit - perfect match
            targetWordIndex = i;
            bestMatch = i;
            break;
          } else {
            // Calculate distance to find closest word
            const distanceToStart = Math.abs(currentTimeMs - startMs);
            const distanceToEnd = Math.abs(currentTimeMs - endMs);
            const minDistanceToWord = Math.min(distanceToStart, distanceToEnd);
            
            if (minDistanceToWord < minDistance) {
              minDistance = minDistanceToWord;
              bestMatch = i;
            }
          }
        }
        
        if (bestMatch >= 0) {
          targetWordIndex = bestMatch;
        }
        
        console.log(`⚡ [WordHighlight] ULTRA-PRECISE - Time: ${preciseAudioTime.toFixed(4)}s (+${PREDICTION_OFFSET_MS}ms), Word: ${targetWordIndex + 1}/${wordTimestamps.length}: "${words[targetWordIndex]}", Distance: ${minDistance.toFixed(1)}ms`);
        setCurrentWordIndex(targetWordIndex);
        
        // Check if we're near the end
        if (targetWordIndex >= wordTimestamps.length - 1 && preciseAudioTime >= (audioDuration * 0.95)) {
          console.log(`🎯 [WordHighlight] Near end with ultra-precise timing, ending highlight`);
          setIsAutoProgressing(false);
          return; // Stop animation
        }
      } else {
        // Ultra-precise fallback timing with microsecond precision
        const realDuration = audioDuration;
        const progress = Math.min(compensatedTime / realDuration, 1);
        
        // Smooth word transition calculation
        const exactWordPosition = progress * words.length;
        const targetWordIndex = Math.floor(exactWordPosition);
        const clampedIndex = Math.min(Math.max(targetWordIndex, 0), words.length - 1);
        
        // Calculate word transition progress for future smooth animations
        const wordProgress = exactWordPosition - targetWordIndex;
        
        console.log(`⚡ [WordHighlight] ULTRA-PRECISE - Time: ${preciseAudioTime.toFixed(4)}s (+${PREDICTION_OFFSET_MS}ms), Progress: ${(progress * 100).toFixed(2)}%, Word: ${clampedIndex + 1}/${words.length} (${(wordProgress * 100).toFixed(1)}%): "${words[clampedIndex]}"`);
        setCurrentWordIndex(clampedIndex);
        
        if (progress >= 0.95) {
          console.log(`🎯 [WordHighlight] Audio near completion with ultra-precise timing, ending highlight`);
          setIsAutoProgressing(false);
          return; // Stop animation
        }
      }
      
      // Continue ultra-precise animation loop
      animationFrameId = requestAnimationFrame(updateWordHighlight);
    };
    
    // Start the ultra-precise animation loop
    animationFrameId = requestAnimationFrame(updateWordHighlight);
    
    // Cleanup function
    return () => {
      console.log(`🧹 [WordHighlight] Canceling ultra-precise requestAnimationFrame`);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isPlaying, words, audioDuration, wordTimestamps]); // Ultra-precise timing dependencies highlighting

  // Clear highlighting when audio stops playing
  useEffect(() => {
    if (!isPlaying && currentWordIndex >= 0) {
      console.log('🎯 [WordHighlight] Audio stopped, clearing highlight');
      setCurrentWordIndex(-1);
      setIsAutoProgressing(false);
    }
  }, [isPlaying, currentWordIndex]);

  // Render text with word highlighting
  const renderHighlightedText = () => {
    console.log(' [WordHighlight] Rendering text, words:', words.length);
    
    if (words.length === 0) {
      console.log(' [WordHighlight] No words, showing plain text');
      console.log('🎯 [WordHighlight] No words, showing plain text');
      return <span style={{ color: 'white' }}>{text}</span>;
    }

    console.log('🎯 [WordHighlight] Rendering with highlighting, currentWordIndex:', currentWordIndex);
    
    return (
      <span>
        {words.map((word, index) => {
          const isCurrentWord = index === currentWordIndex;
          const isPast = index < currentWordIndex && currentWordIndex >= 0;
          
          const wordStyle = isCurrentWord 
            ? { 
                boxShadow: '0 1px 0 #6b7280'
              }
            : {};
          
          return (
            <span
              key={index}
              style={{
                ...wordStyle,
                display: 'inline-block',
                marginRight: '0.25rem',
                transition: 'all 0.2s ease-in-out'
              }}
            >
              {word}
            </span>
          );
        })}
      </span>
    );
  };

  return (
    <div className={className}>
      {speaker && (
        <div style={{ color: '#7dd3fc', fontWeight: 'bold', marginBottom: '8px', fontSize: '20px' }}>
          {speaker}
        </div>
      )}
      <div style={{ color: 'white', fontSize: '18px', lineHeight: '1.6' }}>
        {renderHighlightedText()}
      </div>
    </div>
  );
};

export default WordHighlightText;
