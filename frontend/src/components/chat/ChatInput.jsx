import { useState, useRef, useCallback, useEffect } from 'react';
import QuickReplyPicker from './QuickReplyPicker';
import StickerPicker from './StickerPicker';

const ChatInput = ({ onSend, onTypingStart, onTypingStop, isAgent = false, showQuickReplies: showQuickRepliesProp = false, replyingTo = null, onCancelReply = null }) => {
  const [message, setMessage] = useState('');
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const textareaRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedFileType, setSelectedFileType] = useState(null);

  const handleStickerSelect = ({ type, value }) => {
    if (type === 'emoji') {
      setMessage(prev => prev + value);
    } else if (type === 'sticker') {
      onSend({
        content: 'Sticker',
        type: 'sticker',
        mediaUrl: value,
        replyTo: replyingTo ? replyingTo._id : undefined
      });
      setShowStickerPicker(false);
      if (onCancelReply) onCancelReply();
    }
  };

  const handleInput = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
  }, []);

  const handleChange = (e) => {
    const value = e.target.value;
    setMessage(value);

    if (value === '/' && isAgent) {
      setShowQuickReplies(true);
    }

    if (onTypingStart) {
      onTypingStart();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        if (onTypingStop) onTypingStop();
      }, 2000);
    }
  };

  useEffect(() => {
    handleInput();
  }, [message, handleInput]);

  const handleQuickReplySelect = (template) => {
    if (template.type === 'image') {
      onSend({
        content: template.title || 'Image Template',
        type: 'image',
        mediaUrl: template.mediaUrl,
        mediaPublicId: template.mediaPublicId,
        isInternal: false,
      });
    } else {
      setMessage(template.body || '');
    }
    setShowQuickReplies(false);
    textareaRef.current?.focus();
  };

  const handleSend = () => {
    if (!message.trim() && !selectedFile) return;

    if (selectedFile) {
      onSend({
        content: message.trim(),
        type: selectedFileType,
        file: selectedFile,
        replyTo: replyingTo ? replyingTo._id : undefined
      });
      setSelectedFile(null);
      setSelectedFileType(null);
    } else {
      onSend({
        content: message.trim(),
        isInternal: false,
        replyTo: replyingTo ? replyingTo._id : undefined
      });
    }

    setMessage('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (onTypingStop) onTypingStop();
    if (onCancelReply) onCancelReply();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], `voice-note-${Date.now()}.webm`, { type: 'audio/webm' });

        onSend({
          content: 'Voice Note',
          type: 'audio',
          file: audioFile,
        });

        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Microphone access denied. Please allow microphone access.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setRecordingTime(0);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      mediaRecorderRef.current = null;
      audioChunksRef.current = [];
      setIsRecording(false);
      setRecordingTime(0);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };

  const formatRecordingTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleFileSelect = (type) => {
    const input = document.createElement('input');
    input.type = 'file';

    switch (type) {
      case 'image':
        input.accept = 'image/*';
        break;
      case 'document':
        input.accept = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt';
        break;
      default:
        break;
    }

    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        setSelectedFile(file);
        setSelectedFileType(file.type.startsWith('image/') ? 'image' : 'file');
      }
    };

    input.click();
  };

  if (isRecording) {
    return (
      <div className="border-t border-border bg-surface">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-2 flex-1">
            <div className="w-3 h-3 bg-danger rounded-full animate-pulse" />
            <span className="text-sm font-medium text-text-1">Recording</span>
            <span className="text-sm text-text-2">{formatRecordingTime(recordingTime)}</span>
          </div>
          <button
            onClick={cancelRecording}
            className="px-3 py-1.5 text-sm text-danger hover:bg-danger/10 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={stopRecording}
            className="px-4 py-1.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary-hover transition-colors cursor-pointer"
          >
            Send
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-border bg-surface">
      {replyingTo && (
        <div className="flex items-center justify-between px-4 py-2 bg-primary/5 border-b border-border text-xs">
          <div className="flex-1 min-w-0 border-l-2 border-primary pl-2.5 animate-slide-in">
            <div className="font-bold text-primary truncate">
              Reply to {replyingTo.senderName || (replyingTo.senderRole === 'customer' ? 'Customer' : 'Agent')}
            </div>
            <div className="text-text-2 truncate mt-0.5">
              {replyingTo.content || (replyingTo.type === 'image' ? '📷 Image' : replyingTo.type === 'audio' ? '🎤 Voice note' : '📎 File')}
            </div>
          </div>
          <button onClick={onCancelReply} className="text-text-3 hover:text-text-1 p-1 bg-transparent border-0 cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {selectedFile && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-primary/5 border-b border-border text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            {selectedFileType === 'image' ? (
              <div className="w-10 h-10 rounded-lg overflow-hidden border border-border/80 flex-shrink-0 bg-bg">
                <img src={URL.createObjectURL(selectedFile)} alt="Preview" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-lg bg-bg border border-border/80 flex items-center justify-center flex-shrink-0 text-text-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-bold text-text-1 truncate">{selectedFile.name}</div>
              <div className="text-[10px] text-text-3 font-semibold mt-0.5">{(selectedFile.size / 1024).toFixed(1)} KB • Caption option active</div>
            </div>
          </div>
          <button 
            onClick={() => { setSelectedFile(null); setSelectedFileType(null); }}
            className="text-text-3 hover:text-danger p-1 bg-transparent border-0 cursor-pointer transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {isAgent && (
        <div className="flex items-center gap-1 px-3 pt-2">
          <button
            onClick={() => setShowQuickReplies(!showQuickReplies)}
            className="text-xs px-2 py-1 rounded-md bg-bg border border-border text-text-2 hover:text-text-1 transition-colors"
          >
            / Quick Reply
          </button>
        </div>
      )}

      <div className="relative px-3 py-2">
        {showQuickReplies && (
          <QuickReplyPicker
            onSelect={handleQuickReplySelect}
            onClose={() => setShowQuickReplies(false)}
          />
        )}

        {showStickerPicker && (
          <StickerPicker
            onSelect={handleStickerSelect}
            onClose={() => setShowStickerPicker(false)}
            isCustomer={!isAgent}
          />
        )}

        <div className="flex items-end gap-2">
          <div className="flex items-center gap-1">
            {isAgent && (
              <button
                onClick={() => { setShowStickerPicker(!showStickerPicker); setShowQuickReplies(false); }}
                className={`btn-icon transition-colors ${showStickerPicker ? 'text-primary' : 'text-text-2 hover:text-primary'}`}
                aria-label="Emojis and Stickers"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            )}
            <button
              onClick={() => handleFileSelect('image')}
              className="btn-icon text-text-2 hover:text-primary"
              aria-label="Attach image"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
            <button
              onClick={() => handleFileSelect('document')}
              className="btn-icon text-text-2 hover:text-primary"
              aria-label="Attach file"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>
          </div>

          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="w-full resize-none rounded-xl px-4 py-2 text-sm placeholder-text-3 focus:outline-none focus:ring-2 focus:ring-primary/20 max-h-[120px] bg-bg border border-border"
              rows={1}
            />
          </div>

          {(message.trim() || selectedFile) ? (
            <button
              onClick={handleSend}
              className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white hover:bg-primary-hover transition-colors flex-shrink-0 cursor-pointer border-0"
              style={{ backgroundColor: 'var(--primary)' }}
              aria-label="Send message"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </button>
          ) : (
            <button
              onClick={startRecording}
              className="w-10 h-10 rounded-full bg-bg border border-border flex items-center justify-center text-text-2 hover:text-primary hover:border-primary transition-colors flex-shrink-0 cursor-pointer"
              aria-label="Record voice"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatInput;
