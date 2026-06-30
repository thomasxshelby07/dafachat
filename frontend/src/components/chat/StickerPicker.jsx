import { useState, useEffect } from 'react';
import api from '../../hooks/api';

const EMOJIS = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
  '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
  '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩',
  '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
  '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬',
  '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗',
  '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😬', '🙄', '😯', '😦',
  '😧', '😮', '😲', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢',
  '🤮', '🤧', '😷', '🤒', '🤕', '😈', '👿', '💩', '👻', '💀',
  '👽', '👾', '🤖', '👍', '👎', '👌', '👊', '✊', '🤛', '🤜',
  '🤞', '✌️', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇',
  '☝️', '🤝', '👏', '🙌', '👐', '🤲', '✍️', '💅', '👂', '👃',
  '👁️', '👀', '🧠', '👅', '👄', '💋', '❤️', '🧡', '💛', '💚',
  '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓',
];

const StickerPicker = ({ onSelect, onClose, isCustomer }) => {
  const [activeTab, setActiveTab] = useState(isCustomer ? 'stickers' : 'emojis');
  const [stickers, setStickers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadStickers();
  }, []);

  const loadStickers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/stickers');
      const packs = res.data.packs || [];
      // Combine all stickers from all enabled packs into a single flat list
      const combined = packs.reduce((acc, pack) => [...acc, ...(pack.stickers || [])], []);
      setStickers(combined);
    } catch (error) {
      console.error('Failed to load stickers:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute bottom-full mb-2 left-0 right-0 max-w-sm bg-surface border border-border shadow-float z-40 flex flex-col h-64 select-none animate-fadeIn">
      {/* Header Tabs */}
      <div className="flex border-b border-border text-xs font-semibold">
        {!isCustomer && (
          <button
            onClick={() => setActiveTab('emojis')}
            className={`flex-1 py-3 text-center transition-colors flex items-center justify-center ${
              activeTab === 'emojis'
                ? 'border-b-2 border-primary text-primary bg-primary-light/5'
                : 'text-text-2 hover:bg-bg'
            }`}
          >
            <svg className="w-4 h-4 mr-1.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Emojis
          </button>
        )}
        <button
          onClick={() => setActiveTab('stickers')}
          className={`flex-1 py-3 text-center transition-colors flex items-center justify-center ${
            activeTab === 'stickers'
              ? 'border-b-2 border-primary text-primary bg-primary-light/5'
              : 'text-text-2 hover:bg-bg'
          }`}
        >
          <svg className="w-4 h-4 mr-1.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Stickers
        </button>
        <button
          onClick={onClose}
          className="px-3 text-text-3 hover:text-text-1 hover:bg-bg flex items-center justify-center"
          aria-label="Close picker"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === 'emojis' && !isCustomer ? (
          <div className="grid grid-cols-8 gap-2">
            {EMOJIS.map((emoji, idx) => (
              <button
                key={idx}
                onClick={() => onSelect({ type: 'emoji', value: emoji })}
                className="w-8 h-8 flex items-center justify-center text-xl hover:bg-bg transition-colors active:scale-90"
              >
                {emoji}
              </button>
            ))}
          </div>
        ) : (
          <div className="h-full">
            {loading ? (
              <div className="h-full flex items-center justify-center text-xs text-text-3">
                Loading stickers...
              </div>
            ) : stickers.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-text-3">
                No stickers available
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-3">
                {stickers.map((sticker, idx) => (
                  <button
                    key={idx}
                    onClick={() => onSelect({ type: 'sticker', value: sticker.url })}
                    className="flex items-center justify-center p-1.5 border border-border bg-surface hover:border-primary/50 transition-all active:scale-95"
                  >
                    <img
                      src={sticker.url}
                      alt="Sticker"
                      className="w-16 h-16 object-contain"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StickerPicker;
