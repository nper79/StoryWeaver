import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { Translation } from '../types';

interface LanguageContextType {
  currentLanguage: string;
  translations: Translation[];
  setCurrentLanguage: (language: string) => void;
  setTranslations: (translations: Translation[]) => void;
  addTranslation: (translation: Translation) => void;
  getTranslation: (sceneId: string, language: string) => Translation | undefined;
  availableLanguages: string[];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  children: ReactNode;
  initialLanguage?: string;
  initialTranslations?: Translation[];
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({
  children,
  initialLanguage = 'en',
  initialTranslations = []
}) => {
  const [currentLanguage, setCurrentLanguage] = useState<string>(initialLanguage);
  const [translations, setTranslations] = useState<Translation[]>(initialTranslations);

  // Get available languages from translations
  const availableLanguages = React.useMemo(() => {
    const languages = new Set<string>();
    languages.add('en'); // Always include English as base language
    translations.forEach(t => languages.add(t.language));
    return Array.from(languages).sort();
  }, [translations]);

  const addTranslation = (translation: Translation) => {
    setTranslations(prev => {
      // Remove existing translation for same scene and language
      const filtered = prev.filter(t => 
        !(t.sceneId === translation.sceneId && t.language === translation.language)
      );
      return [...filtered, translation];
    });
  };

  const getTranslation = (sceneId: string, language: string): Translation | undefined => {
    return translations.find(t => t.sceneId === sceneId && t.language === language);
  };

  const value: LanguageContextType = {
    currentLanguage,
    translations,
    setCurrentLanguage,
    setTranslations,
    addTranslation,
    getTranslation,
    availableLanguages
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
