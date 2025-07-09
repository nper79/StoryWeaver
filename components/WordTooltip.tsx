import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { translateWordCached } from '../geminiService';

interface WordTooltipProps {
  word: string;
  isVisible: boolean;
  onClose: () => void;
}

export const WordTooltip: React.FC<WordTooltipProps> = ({ word, isVisible, onClose }) => {
  const [translation, setTranslation] = useState<string>('');
  const [lemma, setLemma] = useState<string>('');
  const [grammarClass, setGrammarClass] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [bottomPosition, setBottomPosition] = useState<number>(160);

  console.log('🎯 [WordTooltip] Render:', { word, isVisible, loading, error });

  useEffect(() => {
    console.log('🔄 [WordTooltip] Effect triggered:', { word, isVisible });
    if (isVisible && word) {
      loadTranslation();
    }
  }, [isVisible, word]);

  // Detect dialogue box height and adjust position
  useEffect(() => {
    if (isVisible) {
      const updatePosition = () => {
        // Find the dialogue/subtitle container at the bottom
        const dialogueContainer = document.querySelector('.absolute.bottom-0');
        if (dialogueContainer) {
          const rect = dialogueContainer.getBoundingClientRect();
          const dialogueHeight = rect.height;
          // Position the translation bar 8px above the dialogue box
          setBottomPosition(dialogueHeight + 8);
        } else {
          // Fallback position
          setBottomPosition(160);
        }
      };
      
      // Initial position update
      updatePosition();
      
      // Update position when content changes
      const observer = new MutationObserver(updatePosition);
      const targetNode = document.querySelector('.absolute.bottom-0');
      if (targetNode) {
        observer.observe(targetNode, { childList: true, subtree: true });
      }
      
      // Update on resize
      window.addEventListener('resize', updatePosition);
      
      return () => {
        observer.disconnect();
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isVisible]);



  const loadTranslation = async () => {
    setLoading(true);
    setError('');
    
    try {
      const result = await translateWordCached(word.toLowerCase());
      
      if (result.error) {
        setError(result.error);
      } else {
        setTranslation(result.translation);
        setLemma(result.lemma || '');
        setGrammarClass(result.grammarClass || '');
      }
    } catch (err) {
      setError('Failed to load translation');
    } finally {
      setLoading(false);
    }
  };

  if (!isVisible) return null;

  const tooltipElement = (
    <div 
      className="fixed left-4 right-4 z-[9999] bg-black/90 backdrop-blur-sm text-white rounded-lg shadow-xl border border-white/20"
      style={{
        bottom: `${bottomPosition}px`,
        pointerEvents: 'auto'
      }}
    >
      <button 
        onClick={onClose}
        className="absolute top-1 right-1 text-white/60 hover:text-white text-sm w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 transition-colors"
      >
        ×
      </button>
      
      {loading && (
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin"></div>
          <span className="text-white/90 text-sm">Translating...</span>
        </div>
      )}
      
      {error && (
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="text-red-400">⚠</div>
          <span className="text-red-300 text-sm">Translation error</span>
        </div>
      )}
      
      {!loading && !error && translation && (
        <div className="px-3 py-2">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-medium whitespace-nowrap">
              {word.toUpperCase()}
            </div>
            <div className="text-lg font-bold text-white break-words flex-1 min-w-0">
              {translation}
            </div>
          </div>
          
          <div className="flex items-center gap-4 mt-2 flex-wrap">
            {lemma && lemma.trim() !== '' && (
              <div className="flex items-center gap-1 text-xs">
                <span className="text-white/60">Lemma:</span>
                <span className="text-white/90 break-words">{lemma}</span>
              </div>
            )}
            
            {grammarClass && grammarClass !== 'unknown' && (
              <div className="flex items-center gap-1 text-xs">
                <span className="text-white/60">Type:</span>
                <span className="bg-gray-600 text-white px-1 py-0.5 rounded text-xs whitespace-nowrap">
                  {grammarClass}
                </span>
              </div>
            )}
          </div>
        </div>
      )}  
    </div>
  );

  return createPortal(tooltipElement, document.body);
};

export default WordTooltip;
