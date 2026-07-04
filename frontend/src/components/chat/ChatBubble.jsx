import React, { useState } from 'react';
import { motion } from 'framer-motion';

const roleLabels = {
  super_admin: 'Super Admin',
  manager: 'Manager',
  agent: 'Agent',
  customer: 'Customer',
};

const roleColors = {
  super_admin: 'bg-purple-100 text-purple-700',
  manager: 'bg-blue-100 text-blue-700',
  agent: 'bg-green-100 text-green-700',
  customer: 'bg-gray-100 text-gray-700',
};

const ChatBubble = ({ message, isOwn, viewerRole = 'customer', onDelete, onImageClick, onChatWithSupportClick, onReply }) => {
  const [showMenu, setShowMenu] = useState(false);

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const renderStatus = (status) => {
    if (!isOwn) return null;
    const colorClass = isOwn ? 'text-white/60' : 'text-text-3';
    const readColorClass = isOwn ? 'text-white' : 'text-primary';

    return (
      <span className="ml-1 flex items-center shrink-0">
        {status === 'sending' && (
          <svg className={`animate-spin h-3 w-3 ${colorClass} opacity-60`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {status === 'sent' && (
          <svg className={`inline h-3.5 w-3.5 ${colorClass}`} viewBox="0 0 16 15" fill="currentColor">
            <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.88a.32.32 0 0 1-.484.033l-.358-.325a.32.32 0 0 0-.484.032l-.378.48a.418.418 0 0 0 .036.54l1.32 1.267a.32.32 0 0 0 .484-.034l6.272-8.05a.365.365 0 0 0-.064-.512z" />
          </svg>
        )}
        {status === 'delivered' && (
          <svg className={`inline h-3.5 w-3.5 ${colorClass}`} viewBox="0 0 16 15" fill="currentColor">
            <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.88a.32.32 0 0 1-.484.033l-.358-.325a.32.32 0 0 0-.484.032l-.378.48a.418.418 0 0 0 .036.54l1.32 1.267a.32.32 0 0 0 .484-.034l6.272-8.05a.365.365 0 0 0-.064-.512z" />
            <path d="M10.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L3.666 9.88a.32.32 0 0 1-.484.033L2.158 9.04a.32.32 0 0 0-.484.032l-.378.48a.418.418 0 0 0 .036.54l2.55 2.393a.32.32 0 0 0 .484-.034l6.272-8.05a.365.365 0 0 0-.064-.512z" />
          </svg>
        )}
        {status === 'read' && (
          <svg className={`inline h-3.5 w-3.5 ${readColorClass}`} viewBox="0 0 16 15" fill="currentColor">
            <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.88a.32.32 0 0 1-.484.033l-.358-.325a.32.32 0 0 0-.484.032l-.378.48a.418.418 0 0 0 .036.54l1.32 1.267a.32.32 0 0 0 .484-.034l6.272-8.05a.365.365 0 0 0-.064-.512z" />
            <path d="M10.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L3.666 9.88a.32.32 0 0 1-.484.033L2.158 9.04a.32.32 0 0 0-.484.032l-.378.48a.418.418 0 0 0 .036.54l2.55 2.393a.32.32 0 0 0 .484-.034l6.272-8.05a.365.365 0 0 0-.064-.512z" />
          </svg>
        )}
      </span>
    );
  };

  if (message.isDeleted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex ${isOwn ? 'justify-end' : 'justify-start'} px-4 py-0.5`}
      >
        <div className="max-w-[80%] px-3.5 py-2.5 bg-bg border border-border rounded-lg">
          <div className="flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-text-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            <p className="text-sm text-text-3 italic">This message was deleted</p>
          </div>
        </div>
      </motion.div>
    );
  }

  if (message.type === 'sticker') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className={`flex ${isOwn ? 'justify-end' : 'justify-start'} px-4 py-1 group`}
        onMouseLeave={() => setShowMenu(false)}
      >
        <div className="relative max-w-[60%] cursor-pointer hover:opacity-90 transition-opacity" onClick={() => onImageClick?.(message.mediaUrl)}>
          <img
            src={message.mediaUrl}
            alt="Sticker"
            className="w-24 h-24 object-contain"
            loading="lazy"
          />
          <div className={`flex items-center gap-0.5 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
            <span className="text-[11px] text-text-3">
              {formatTime(message.createdAt)}
            </span>
            {renderStatus(message.status)}
          </div>
        </div>
      </motion.div>
    );
  }

  if (message.isInternal) {
    const canDeleteNote = viewerRole !== 'customer' && onDelete;
    return (
      <div 
        className="px-3.5 py-0.5 group relative flex justify-start"
        onMouseLeave={() => setShowMenu(false)}
      >
        <div className="relative max-w-[90%] bg-note border-l-[3px] border-note-border rounded-r-lg px-2.5 py-1.5 text-left">
          <div className="flex items-center gap-1.5 mb-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span className="text-[10px] font-medium text-text-2 italic">Internal Note</span>
          </div>
          <p className="text-[13px] text-text-1 italic">{message.content}</p>
          {message.createdAt && (
            <p className="text-[10px] text-text-3 mt-1">
              {message.senderName || 'Staff'} · {formatTime(message.createdAt)}
            </p>
          )}
        </div>

        {canDeleteNote && (
          <div className="relative flex items-center shrink-0">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-bg self-center"
              aria-label="Note options"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-text-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
            {showMenu && (
              <div className="absolute left-8 top-1/2 -translate-y-1/2 bg-surface border border-border rounded-lg shadow-float z-30 py-1 min-w-[100px]">
                <button
                  onClick={() => { setShowMenu(false); onDelete(message._id); }}
                  className="w-full px-3 py-2 text-left text-sm text-danger hover:bg-danger/10 flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  const renderMedia = () => {
    if (!message.mediaUrl) return null;

    switch (message.type) {
      case 'image':
        return (
          <div className="mb-1 cursor-pointer hover:opacity-90 transition-opacity relative rounded-lg overflow-hidden" onClick={() => message.status !== 'sending' && onImageClick?.(message.mediaUrl)}>
            <img
              src={message.mediaUrl}
              alt="Shared image"
              className={`max-w-full max-h-60 object-cover rounded-lg ${message.status === 'sending' ? 'blur-[1.5px] brightness-75' : ''}`}
              loading="lazy"
            />
            {message.status === 'sending' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-white bg-black/40">
                <svg className="animate-spin h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-100">Sending...</span>
              </div>
            )}
          </div>
        );
      case 'audio':
        return (
          <div className="mb-1">
            <div className="flex items-center gap-2 bg-bg rounded-lg p-2 min-w-[200px]">
              {message.status === 'sending' ? (
                <>
                  <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0 animate-pulse">
                    <svg className="animate-spin h-4 w-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </div>
                  <div className="flex-1 flex flex-col justify-center animate-pulse">
                    <span className="text-[11px] font-semibold text-text-2">Uploading voice note...</span>
                    <div className="w-full bg-border rounded-full h-1 mt-1 overflow-hidden">
                      <div className="bg-primary h-full rounded-full w-2/3" />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  </div>
                  <audio controls className="flex-1 h-8" preload="metadata">
                    <source src={message.mediaUrl} />
                  </audio>
                </>
              )}
            </div>
          </div>
        );
      case 'document':
      case 'file':
        return (
          <div className="mb-1 p-2 bg-bg rounded-lg flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-text-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <a
              href={message.mediaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary underline truncate"
            >
              {message.content || 'Download file'}
            </a>
          </div>
        );
      default:
        return null;
    }
  };

  const canDelete = viewerRole !== 'customer' && message.senderRole !== 'customer' && onDelete;

  const parseBoldText = (str) => {
    if (typeof str !== 'string') return str;
    const boldRegex = /(\*\*[^*]+\*\*)/g;
    const segments = str.split(boldRegex);
    return segments.map((seg, i) => {
      const match = seg.match(/^\*\*([^*]+)\*\*$/);
      if (match) {
        return <strong key={i} className="font-extrabold">{match[1]}</strong>;
      }
      return seg;
    });
  };

  const renderMessageContent = (text) => {
    if (!text) return null;
    const markdownLinkRegex = /(\[[^\]]+\]\([^)]+\))/g;
    const parts = text.split(markdownLinkRegex);

    return parts.map((part, index) => {
      const match = part.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (match) {
        const linkText = match[1];
        const linkUrl = match[2];
        const isExternal = linkUrl.startsWith('http');
        
        const handleClick = (e) => {
          if (linkUrl === '#chat-with-support' || linkUrl === '#open-support-options') {
            e.preventDefault();
            if (onChatWithSupportClick) {
              onChatWithSupportClick();
            }
          }
        };

        return (
          <a
            key={index}
            href={linkUrl}
            onClick={handleClick}
            target={isExternal ? "_blank" : undefined}
            rel={isExternal ? "noopener noreferrer" : undefined}
            className="inline-block bg-primary text-white font-extrabold text-xs px-3.5 py-1.5 rounded-lg shadow-sm hover:brightness-110 active:scale-95 transition-all my-1 text-center decoration-none cursor-pointer"
            style={{ textDecoration: 'none', backgroundColor: 'var(--primary)' }}
          >
            {linkUrl === '#chat-with-support' || linkUrl === '#open-support-options' ? '💬' : '🔑'} {linkText}
          </a>
        );
      }
      return <span key={index}>{parseBoldText(part)}</span>;
    });
  };

  return (
    <motion.div
      id={`msg-${message._id}`}
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`flex ${isOwn ? 'justify-end' : 'justify-start'} px-3.5 py-0.5 group`}
      onMouseLeave={() => setShowMenu(false)}
    >
      <div className="flex items-center gap-2 max-w-[85%] relative">
        {isOwn && onReply && (
          <button
            onClick={onReply}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full hover:bg-bg text-text-3 hover:text-primary order-first shrink-0 bg-transparent border-0 cursor-pointer"
            title="Reply"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 transform -scale-x-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          </button>
        )}

        <div
          onDoubleClick={onReply}
          className={`
            px-3.5 py-2 relative
            ${isOwn
              ? 'text-white rounded-2xl rounded-tr-sm shadow-sm'
              : 'bg-bubble-customer text-bubble-customer-text border border-border/80 rounded-2xl rounded-tl-sm shadow-sm'
            }
          `}
          style={isOwn ? { backgroundColor: 'var(--primary)' } : {}}
        >
          {message.replyTo && (
            <div 
              onClick={(e) => {
                e.stopPropagation();
                const el = document.getElementById(`msg-${message.replyTo._id}`);
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  el.classList.add('bg-primary/20', 'transition-all', 'duration-500');
                  setTimeout(() => el.classList.remove('bg-primary/20'), 1500);
                }
              }}
              className={`mb-1.5 p-2 rounded text-[11px] border-l-2 text-left cursor-pointer transition-colors ${
                isOwn 
                  ? 'bg-black/15 border-white/50 text-white/90 hover:bg-black/20' 
                  : 'bg-bg border-primary/50 text-text-2 hover:bg-bg/85'
              }`}
            >
              <div className="font-bold truncate">
                {message.replyTo.senderName || (message.replyTo.senderRole === 'customer' ? 'Customer' : 'Agent')}
              </div>
              <div className="truncate opacity-80 mt-0.5">
                {message.replyTo.content || (message.replyTo.type === 'image' ? '📷 Image' : message.replyTo.type === 'audio' ? '🎤 Voice note' : '📎 File')}
              </div>
            </div>
          )}

          {renderMedia()}
          {message.senderRole && viewerRole !== 'customer' && message.senderRole !== 'customer' && (
            <div className={`mb-0.5 ${isOwn ? 'text-right' : ''}`}>
              <span className={`inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${roleColors[message.senderRole] || roleColors.agent}`}>
                {message.senderName || roleLabels[message.senderRole] || 'Staff'}
              </span>
            </div>
          )}
          {message.senderRole && viewerRole !== 'customer' && message.senderRole === 'customer' && (
            <div className="mb-0.5">
              <span className={`inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${roleColors.customer}`}>
                {message.senderName || 'Customer'}
              </span>
            </div>
          )}
          {message.content && message.type !== 'audio' && (
            <div className="text-[13px] leading-relaxed whitespace-pre-wrap break-words">
              {renderMessageContent(message.content)}
            </div>
          )}
          <div className={`flex items-center gap-0.5 mt-0.5 ${isOwn ? 'justify-end' : 'justify-start'}`}>
            <span className={`text-[9px] ${isOwn ? 'text-white/70 font-semibold' : 'text-text-3'}`}>
              {formatTime(message.createdAt)}
            </span>
            {renderStatus(message.status)}
          </div>

          {canDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
              className={`absolute top-1 ${isOwn ? '-left-7' : '-right-7'} opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-bg bg-transparent border-0 cursor-pointer`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-text-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
          )}

          {showMenu && (
            <div className={`absolute top-0 ${isOwn ? 'right-0 mr-1' : 'left-0 ml-1'} bg-surface border border-border rounded-lg shadow-float z-30 py-1 min-w-[100px]`}>
              <button
                onClick={(e) => { e.stopPropagation(); setShowMenu(false); onDelete(message._id); }}
                className="w-full px-3 py-2 text-left text-sm text-danger hover:bg-danger/10 flex items-center gap-2 bg-transparent border-0 cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </button>
            </div>
          )}
        </div>

        {!isOwn && onReply && (
          <button
            onClick={onReply}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full hover:bg-bg text-text-3 hover:text-primary shrink-0 bg-transparent border-0 cursor-pointer"
            title="Reply"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          </button>
        )}
      </div>
    </motion.div>
  );
};

export default React.memo(ChatBubble);
