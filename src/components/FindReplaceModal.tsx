import React, { useState, useEffect, useRef } from 'react';
import { Search, ArrowUp, ArrowDown, X, GripVertical } from 'lucide-react';
import { motion } from 'framer-motion';

interface FindReplaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  onContentChange: (content: string) => void;
  initialSearchText?: string;
}

export const FindReplaceModal: React.FC<FindReplaceModalProps> = ({
  isOpen,
  onClose,
  content,
  onContentChange,
  initialSearchText = ''
}) => {
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [matches, setMatches] = useState<number[]>([]);
  const [currentMatch, setCurrentMatch] = useState(-1);
  const findInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && initialSearchText) {
      setFindText(initialSearchText);
    }
  }, [isOpen, initialSearchText]);

  useEffect(() => {
    if (isOpen && findInputRef.current) {
      findInputRef.current.focus();
      findInputRef.current.select();
    }
  }, [isOpen]);

  useEffect(() => {
    if (findText) {
      const regex = new RegExp(findText, 'gi');
      const newMatches: number[] = [];
      let match;
      while ((match = regex.exec(content)) !== null) {
        newMatches.push(match.index);
      }
      setMatches(newMatches);
      setCurrentMatch(newMatches.length > 0 ? 0 : -1);
    } else {
      setMatches([]);
      setCurrentMatch(-1);
    }
  }, [findText, content]);

  const handleReplace = () => {
    if (!findText) return;
    const regex = new RegExp(findText, 'g');
    const newContent = content.replace(regex, replaceText);
    onContentChange(newContent);
    setFindText('');
    setReplaceText('');
    onClose();
  };

  const handleReplaceAll = () => {
    if (!findText) return;
    const regex = new RegExp(findText, 'g');
    const newContent = content.replace(regex, replaceText);
    onContentChange(newContent);
    setFindText('');
    setReplaceText('');
    onClose();
  };

  const navigateMatch = (direction: 'next' | 'prev') => {
    if (matches.length === 0) return;
    
    // Update current match index
    if (direction === 'next') {
      setCurrentMatch((currentMatch + 1) % matches.length);
    } else {
      setCurrentMatch((currentMatch - 1 + matches.length) % matches.length);
    }

    // Get the new current match index after state update
    const newCurrentMatch = direction === 'next' 
      ? (currentMatch + 1) % matches.length
      : (currentMatch - 1 + matches.length) % matches.length;

    // Scroll to and highlight match
    const matchPosition = matches[newCurrentMatch];
    const textArea = document.querySelector('[contenteditable="true"]') as HTMLElement;
    if (textArea) {
      const range = document.createRange();
      const textNode = textArea.firstChild;
      if (textNode) {
        // Remove any existing highlights
        const existingHighlights = textArea.querySelectorAll('.current-match');
        existingHighlights.forEach(highlight => {
          const parent = highlight.parentNode;
          if (parent) {
            parent.replaceChild(document.createTextNode(highlight.textContent || ''), highlight);
          }
        });

        // Create highlight span for current match
        const matchText = content.substr(matchPosition, findText.length);
        const highlightSpan = document.createElement('span');
        highlightSpan.textContent = matchText;
        highlightSpan.className = 'current-match bg-indigo-500/30 rounded px-0.5';

        // Split text and insert highlight
        const beforeText = document.createTextNode(content.substring(0, matchPosition));
        const afterText = document.createTextNode(content.substring(matchPosition + findText.length));
        
        textArea.innerHTML = '';
        textArea.appendChild(beforeText);
        textArea.appendChild(highlightSpan);
        textArea.appendChild(afterText);

        // Set selection to the highlighted text
        range.selectNodeContents(highlightSpan);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        
        // Scroll match into view with offset
        highlightSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  // Add effect to highlight initial matches when search text changes
  useEffect(() => {
    if (findText && matches.length > 0) {
      navigateMatch('next');
    }
  }, [matches.length]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 pointer-events-none">
      <motion.div
        drag
        dragMomentum={false}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="absolute bottom-20 right-6 bg-gray-800/95 backdrop-blur-sm rounded-lg shadow-2xl border border-gray-700 w-[400px] pointer-events-auto"
      >
        <div className="flex items-center justify-between p-2 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <GripVertical className="w-4 h-4 text-gray-400 cursor-move" />
            <h2 className="text-sm font-medium text-gray-200">Find & Replace</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 space-y-3">
          {/* Find */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-gray-400" />
              <input
                ref={findInputRef}
                type="text"
                value={findText}
                onChange={(e) => setFindText(e.target.value)}
                placeholder="Find..."
                className="flex-1 bg-gray-700/50 text-white px-2 py-1 rounded text-sm"
              />
              <span className="text-xs text-gray-400 min-w-[40px] text-center">
                {matches.length > 0 ? `${currentMatch + 1}/${matches.length}` : '0/0'}
              </span>
              <button
                onClick={() => navigateMatch('prev')}
                disabled={matches.length === 0}
                className="p-1 hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => navigateMatch('next')}
                disabled={matches.length === 0}
                className="p-1 hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Replace */}
          <div className="space-y-1.5">
            <input
              type="text"
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              placeholder="Replace with..."
              className="w-full bg-gray-700/50 text-white px-2 py-1 rounded text-sm"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 pt-1">
            <button
              onClick={handleReplace}
              disabled={matches.length === 0}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs transition-colors disabled:opacity-50"
            >
              Replace
            </button>
            <button
              onClick={handleReplaceAll}
              disabled={matches.length === 0}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs transition-colors disabled:opacity-50"
            >
              Replace All
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};