
import React, { useState, useEffect, useRef } from 'react';

interface EditableTextProps {
  initialValue: string;
  onSave: (newValue: string) => void;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  isTextarea?: boolean;
  inputFontSize?: string; // e.g., 'text-sm', 'text-base'
}

const EditableText: React.FC<EditableTextProps> = ({
  initialValue,
  onSave,
  className,
  inputClassName,
  placeholder = "Editable text",
  isTextarea = false,
  inputFontSize = "text-base"
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const displayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (isTextarea && inputRef.current instanceof HTMLTextAreaElement) {
        // Auto-adjust height for textarea
        inputRef.current.style.height = 'auto';
        inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
      }
    }
  }, [isEditing, isTextarea]);

  const handleDisplayClick = () => {
    setIsEditing(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setValue(e.target.value);
    if (isTextarea && inputRef.current instanceof HTMLTextAreaElement) {
      // Auto-adjust height for textarea while typing
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
    }
  };

  const handleBlur = () => {
    onSave(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !isTextarea && !e.shiftKey) {
      e.preventDefault(); // Prevent new line in input if it's not textarea
      handleBlur();
    } else if (e.key === 'Escape') {
      setValue(initialValue); // Revert to initial value
      setIsEditing(false);
    }
  };

  if (isEditing) {
    const commonInputProps = {
      value: value,
      onChange: handleChange,
      onBlur: handleBlur,
      onKeyDown: handleKeyDown,
      className: `w-full p-1.5 border border-sky-500 rounded bg-slate-600 text-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-400 ${inputFontSize} ${inputClassName}`,
    };
    return isTextarea ? (
      <textarea
        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
        {...commonInputProps}
        rows={3} // Initial rows, will auto-adjust
        style={{ minHeight: '60px', overflowY: 'hidden' }} // For auto-height adjustment
      />
    ) : (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type="text"
        {...commonInputProps}
      />
    );
  }

  return (
    <div
      ref={displayRef}
      onClick={handleDisplayClick}
      className={`cursor-pointer p-1.5 min-h-[2.5em] ${className} ${isTextarea ? 'whitespace-pre-wrap break-words' : 'truncate'} ${!value ? 'text-slate-400 italic' : ''}`}
      title="Click to edit"
    >
      {value || placeholder}
    </div>
  );
};

export default EditableText;