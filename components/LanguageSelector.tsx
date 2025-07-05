import React from 'react';
import { TranslationService } from '../services/translationService';

interface LanguageSelectorProps {
  currentLanguage: string;
  onLanguageChange: (language: string) => void;
  availableLanguages?: string[];
  className?: string;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  currentLanguage,
  onLanguageChange,
  availableLanguages,
  className = ''
}) => {
  const supportedLanguages = TranslationService.getSupportedLanguages();
  
  // Use available languages if provided, otherwise show all supported
  const languagesToShow = availableLanguages || Object.keys(supportedLanguages);

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <label className="text-sm font-medium text-slate-300">
        Language:
      </label>
      <select
        value={currentLanguage}
        onChange={(e) => onLanguageChange(e.target.value)}
        className="bg-slate-700 border border-slate-600 text-slate-100 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 px-3 py-1.5"
      >
        {languagesToShow.map((langCode) => (
          <option key={langCode} value={langCode}>
            {supportedLanguages[langCode] || langCode.toUpperCase()}
          </option>
        ))}
      </select>
    </div>
  );
};

export default LanguageSelector;
