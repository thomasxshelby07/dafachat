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
