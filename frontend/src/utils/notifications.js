let permissionGranted = Notification.permission === 'granted';

export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    return false;
  }

  if (Notification.permission === 'granted') {
    permissionGranted = true;
    return true;
  }

  if (Notification.permission === 'denied') {
    permissionGranted = false;
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    permissionGranted = permission === 'granted';
    return permissionGranted;
  } catch {
    permissionGranted = false;
    return false;
  }
};

export const showBrowserNotification = (title, options = {}) => {
  if (!permissionGranted && Notification.permission !== 'granted') {
    return;
  }

  try {
    const notif = new Notification(title, {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: options.tag || 'dafax-notification',
      renotify: true,
      requireInteraction: false,
      silent: false,
      ...options,
    });

    notif.onclick = () => {
      window.focus();
      notif.close();
    };

    setTimeout(() => notif.close(), 8000);
  } catch (e) {
    // Notification failed silently
  }
};

export const isNotificationSupported = () => {
  return 'Notification' in window;
};

export const getPermissionStatus = () => {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
};

export const playNotificationSound = () => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    const playTone = (freq, startTime, duration) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      
      gain.gain.setValueAtTime(0.1, startTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = audioCtx.currentTime;
    playTone(523.25, now, 0.15); // C5
    playTone(659.25, now + 0.15, 0.2); // E5
  } catch (e) {
    console.error('Failed to play notification sound:', e);
  }
};
