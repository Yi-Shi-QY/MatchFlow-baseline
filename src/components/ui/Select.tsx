import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  className?: string;
}

export function Select({ value, onChange, options, className = '' }: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const selectedOption = options.find(opt => opt.value === value) || options[0];

  useEffect(() => {
    if (!isOpen) return;

    const updateMenuPosition = () => {
      const trigger = selectRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      setMenuStyle({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    };

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (selectRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className={`relative ${className}`} ref={selectRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-[var(--mf-surface)] border border-[var(--mf-border)] rounded-lg p-3 text-sm text-[var(--mf-text)] focus:outline-none focus:border-[var(--mf-accent)] transition-colors flex justify-between items-center"
      >
        <span>{selectedOption?.label}</span>
        <ChevronDown className={`w-4 h-4 text-[var(--mf-text-muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && menuStyle && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[1000] bg-[var(--mf-surface)] border border-[var(--mf-border)] rounded-lg shadow-lg overflow-hidden"
          style={{
            top: `${menuStyle.top}px`,
            left: `${menuStyle.left}px`,
            width: `${menuStyle.width}px`,
          }}
        >
          <ul className="max-h-60 overflow-auto py-1">
            {options.map((option) => (
              <li
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`px-3 py-2 text-sm cursor-pointer transition-colors ${
                  option.value === value
                    ? 'bg-[var(--mf-accent-soft)] text-[var(--mf-accent)]'
                    : 'text-[var(--mf-text)] hover:bg-[var(--mf-surface-muted)]'
                }`}
              >
                {option.label}
              </li>
            ))}
          </ul>
        </div>,
        document.body,
      )}
    </div>
  );
}
