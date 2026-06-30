import { useState, useEffect } from 'react';
import api from '../../hooks/api';

const StickerManager = () => {
  const [stickers, setStickers] = useState([]);
  const [defaultPackId, setDefaultPackId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadStickers();
  }, []);

  const loadStickers = async () => {
    try {
      const res = await api.get('/api/stickers');
      const packs = res.data.packs || [];
      
      if (packs.length === 0) {
        // Create default pack behind the scenes if none exists
        const createRes = await api.post('/api/stickers/packs', {
          name: 'Global Stickers',
          category: 'Other',
          stickers: []
        });
        setDefaultPackId(createRes.data.pack._id);
        setStickers([]);
      } else {
        setDefaultPackId(packs[0]._id);
        setStickers(packs[0].stickers || []);
      }
    } catch (error) {
      console.error('Failed to load stickers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !defaultPackId) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await api.post('/api/messages/media', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const newSticker = { url: uploadRes.data.mediaUrl, tags: [] };
      const updatedStickers = [...stickers, newSticker];

      const patchRes = await api.patch(`/api/stickers/packs/${defaultPackId}`, {
        stickers: updatedStickers,
      });

      setStickers(patchRes.data.pack.stickers || []);
    } catch (error) {
      console.error('Failed to upload sticker:', error);
      alert('Sticker upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteSticker = async (indexToDelete) => {
    if (!confirm('Are you sure you want to delete this sticker?') || !defaultPackId) return;

    try {
      const updatedStickers = stickers.filter((_, idx) => idx !== indexToDelete);
      const patchRes = await api.patch(`/api/stickers/packs/${defaultPackId}`, {
        stickers: updatedStickers,
      });

      setStickers(patchRes.data.pack.stickers || []);
    } catch (error) {
      console.error('Failed to delete sticker:', error);
      alert('Failed to delete sticker');
    }
  };

  return (
    <div className="bg-surface border border-border">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div>
          <h2 className="text-base font-semibold text-text-1">Sticker Settings</h2>
          <p className="text-xs text-text-2">Upload and manage stickers available in chat.</p>
        </div>
        <label className="btn-primary text-sm flex items-center justify-center cursor-pointer min-h-[40px] select-none">
          {uploading ? 'Uploading...' : '+ Upload Sticker'}
          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
            disabled={uploading}
          />
        </label>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : stickers.length === 0 ? (
          <div className="text-center py-12 text-sm text-text-3 border border-dashed border-border bg-bg/50">
            No stickers uploaded yet. Click "+ Upload Sticker" to start.
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
            {stickers.map((sticker, idx) => (
              <div key={idx} className="relative group border border-border bg-bg p-2 flex flex-col items-center justify-center">
                <img
                  src={sticker.url}
                  alt="Sticker"
                  className="w-20 h-20 object-contain"
                />
                <button
                  onClick={() => handleDeleteSticker(idx)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-600 hover:bg-red-700 text-white flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-sm border border-red-700"
                  title="Delete sticker"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StickerManager;
