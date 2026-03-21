import clickSrc from '../assets/sounds/ui_click.wav';
import cashSuccessSrc from '../assets/sounds/ui_cash_success.wav';
import destructiveSrc from '../assets/sounds/ui_destructive.wav';
import errorSrc from '../assets/sounds/ui_error.wav';
import navigationSrc from '../assets/sounds/ui_navigation.wav';
import notificationSrc from '../assets/sounds/ui_notification.wav';
import operationsSuccessSrc from '../assets/sounds/ui_operations_success.wav';
import operationsWarningSrc from '../assets/sounds/ui_operations_warning.wav';
import pdvSuccessSrc from '../assets/sounds/ui_pdv_success.wav';
import successSrc from '../assets/sounds/ui_success.wav';
import warningSrc from '../assets/sounds/ui_warning.wav';

const SOUND_ENABLED_STORAGE_KEY = 'nexus-sound-effects-enabled';
const SOUND_PROFILE_STORAGE_KEY = 'nexus-sound-effects-profile';
const DEFAULT_ENABLED = true;
const DEFAULT_PROFILE = 'balanced';

const soundProfiles = {
  soft: { label: 'Suave', multiplier: 0.82 },
  balanced: { label: 'Padrao', multiplier: 1 },
  vivid: { label: 'Intenso', multiplier: 1.18 },
};

const soundLibrary = {
  click: { src: clickSrc, volume: 0.14, minGap: 70 },
  cashSuccess: { src: cashSuccessSrc, volume: 0.17, minGap: 180 },
  success: { src: successSrc, volume: 0.19, minGap: 140 },
  error: { src: errorSrc, volume: 0.17, minGap: 180 },
  navigation: { src: navigationSrc, volume: 0.13, minGap: 120 },
  notification: { src: notificationSrc, volume: 0.17, minGap: 220 },
  operationsSuccess: { src: operationsSuccessSrc, volume: 0.15, minGap: 150 },
  operationsWarning: { src: operationsWarningSrc, volume: 0.14, minGap: 170 },
  pdvSuccess: { src: pdvSuccessSrc, volume: 0.16, minGap: 120 },
  warning: { src: warningSrc, volume: 0.15, minGap: 180 },
  destructive: { src: destructiveSrc, volume: 0.16, minGap: 160 },
};

let enabled = DEFAULT_ENABLED;
let profile = DEFAULT_PROFILE;
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

function loadStoredProfile() {
  if (typeof window === 'undefined') {
    return DEFAULT_PROFILE;
  }

  const rawValue = window.localStorage.getItem(SOUND_PROFILE_STORAGE_KEY);

  if (!rawValue || !soundProfiles[rawValue]) {
    return DEFAULT_PROFILE;
  }

  return rawValue;
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
  audio.volume = Math.max(0, Math.min(1, config.volume * (soundProfiles[profile]?.multiplier ?? 1)));
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
    button.classList.contains('ui-button--danger')
    || button.classList.contains('orders-domain__delete-button')
    || button.classList.contains('commerce-step__remove-button')
    || button.classList.contains('ui-destructive-button')
  ) {
    playSound('destructive');
    return;
  }

  if (
    button.classList.contains('ui-button--primary')
    || button.classList.contains('ui-button--secondary')
    || button.classList.contains('ui-button--success')
    || button.classList.contains('ui-button--ghost')
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
  profile = loadStoredProfile();
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

export function getSoundProfile() {
  initializeSoundManager();
  return profile;
}

export function getSoundProfiles() {
  return Object.entries(soundProfiles).map(([id, data]) => ({
    id,
    label: data.label,
  }));
}

export function setSoundProfile(nextProfile) {
  const normalizedProfile = soundProfiles[nextProfile] ? nextProfile : DEFAULT_PROFILE;
  profile = normalizedProfile;

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(SOUND_PROFILE_STORAGE_KEY, normalizedProfile);
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

export function playCashSuccess() {
  playSound('cashSuccess');
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

export function playOperationalSuccess() {
  playSound('operationsSuccess');
}

export function playPdvSuccess() {
  playSound('pdvSuccess');
}

export function playWarning() {
  playSound('warning');
}

export function playOperationalWarning() {
  playSound('operationsWarning');
}

export function playDestructive() {
  playSound('destructive');
}

export function previewSoundCategory(category) {
  const previewMap = {
    cash: 'cashSuccess',
    pdv: 'pdvSuccess',
    operations: 'operationsSuccess',
    warning: 'operationsWarning',
  };

  playSound(previewMap[category] ?? 'click');
}
