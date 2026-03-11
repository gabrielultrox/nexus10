import clickSrc from '../assets/sounds/ui_click.wav';
import errorSrc from '../assets/sounds/ui_error.wav';
import navigationSrc from '../assets/sounds/ui_navigation.wav';
import notificationSrc from '../assets/sounds/ui_notification.wav';
import successSrc from '../assets/sounds/ui_success.wav';

const SOUND_ENABLED_STORAGE_KEY = 'nexus-sound-effects-enabled';
const DEFAULT_ENABLED = true;

const soundLibrary = {
  click: { src: clickSrc, volume: 0.16, minGap: 70 },
  success: { src: successSrc, volume: 0.2, minGap: 140 },
  error: { src: errorSrc, volume: 0.18, minGap: 180 },
  navigation: { src: navigationSrc, volume: 0.15, minGap: 120 },
  notification: { src: notificationSrc, volume: 0.18, minGap: 220 },
};

let enabled = DEFAULT_ENABLED;
let activeAudio = null;
let initialized = false;
let listenersBound = false;
const audioCache = new Map();
const lastPlayedAt = new Map();

function canUseAudio() {
  return typeof window !== 'undefined' && typeof Audio !== 'undefined';
}

function loadStoredEnabled() {
  if (typeof window === 'undefined') {
    return DEFAULT_ENABLED;
  }

  const rawValue = window.localStorage.getItem(SOUND_ENABLED_STORAGE_KEY);

  if (rawValue == null) {
    return DEFAULT_ENABLED;
  }

  return rawValue !== 'false';
}

function getAudioInstance(key) {
  if (!canUseAudio()) {
    return null;
  }

  if (!audioCache.has(key)) {
    const audio = new Audio(soundLibrary[key].src);
    audio.preload = 'auto';
    audioCache.set(key, audio);
  }

  return audioCache.get(key);
}

function stopActiveAudio() {
  if (!activeAudio) {
    return;
  }

  activeAudio.pause();
  activeAudio.currentTime = 0;
  activeAudio = null;
}

function playSound(key) {
  if (!enabled || !canUseAudio()) {
    return;
  }

  const config = soundLibrary[key];

  if (!config) {
    return;
  }

  const now = Date.now();
  const lastTime = lastPlayedAt.get(key) ?? 0;

  if (now - lastTime < config.minGap) {
    return;
  }

  const audio = getAudioInstance(key);

  if (!audio) {
    return;
  }

  lastPlayedAt.set(key, now);
  stopActiveAudio();
  audio.volume = config.volume;
  audio.currentTime = 0;
  activeAudio = audio;
  audio.play().catch(() => {
    activeAudio = null;
  });
}

function handleGlobalButtonClick(event) {
  const target = event.target instanceof Element ? event.target : null;

  if (!target) {
    return;
  }

  const button = target.closest('button, [role="button"]');

  if (!button || button.hasAttribute('disabled')) {
    return;
  }

  if (
    button.classList.contains('ui-button--secondary')
    || button.classList.contains('ui-button--success')
    || button.classList.contains('auth-submit')
  ) {
    playSound('click');
  }
}

export function initializeSoundManager() {
  if (initialized) {
    return;
  }

  enabled = loadStoredEnabled();
  initialized = true;
}

export function bindGlobalSoundEffects() {
  initializeSoundManager();

  if (listenersBound || typeof document === 'undefined') {
    return;
  }

  document.addEventListener('click', handleGlobalButtonClick, true);
  listenersBound = true;
}

export function unbindGlobalSoundEffects() {
  if (!listenersBound || typeof document === 'undefined') {
    return;
  }

  document.removeEventListener('click', handleGlobalButtonClick, true);
  listenersBound = false;
}

export function isSoundEnabled() {
  initializeSoundManager();
  return enabled;
}

export function setSoundEnabled(nextValue) {
  enabled = Boolean(nextValue);

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(SOUND_ENABLED_STORAGE_KEY, String(enabled));
  }

  if (!enabled) {
    stopActiveAudio();
  }
}

export function toggleSoundEnabled() {
  setSoundEnabled(!isSoundEnabled());
}

export function playClick() {
  playSound('click');
}

export function playSuccess() {
  playSound('success');
}

export function playError() {
  playSound('error');
}

export function playNavigation() {
  playSound('navigation');
}

export function playNotification() {
  playSound('notification');
}
