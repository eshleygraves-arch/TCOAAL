// Фоновая музыка из The Coffin of Andy and Leyley ("Twisted Clowns" OST)
(() => {
  const YT_VIDEO_ID = 'uOURpKlYRxk';
  const LOCAL_AUDIO_SRC = 'audio/theme.mp3';
  const STORAGE_MUTED_KEY = 'tcoaal_music_muted';
  const STORAGE_TIME_KEY = 'tcoaal_music_time';
  const DEFAULT_VOLUME = 45;

  const audioToggle = document.getElementById('audioToggle');
  const audioText = document.getElementById('audioText');
  const audioIcon = document.getElementById('audioIcon');

  if (!audioToggle || !audioText || !audioIcon) return;

  let ytPlayer = null;
  let ytReady = false;
  let localAudio = null;
  let activeMode = 'youtube'; // 'youtube' | 'local' | 'unavailable'
  let isPlaying = false;
  let pendingPlay = false;
  let hasUserInteracted = false;

  const isMutedByUser = () => localStorage.getItem(STORAGE_MUTED_KEY) === 'true';
  const setMutedByUser = (muted) => localStorage.setItem(STORAGE_MUTED_KEY, String(muted));

  function updateButtonUI() {
    if (isPlaying) {
      audioIcon.textContent = '🎵';
      audioText.textContent = 'Музыка: Вкл';
      audioToggle.classList.add('is-playing');
    } else if (pendingPlay) {
      audioIcon.textContent = '⏳';
      audioText.textContent = 'Музыка: Загрузка...';
      audioToggle.classList.remove('is-playing');
    } else {
      audioIcon.textContent = '🔇';
      audioText.textContent = 'Музыка: Выкл';
      audioToggle.classList.remove('is-playing');
    }
  }

  function getSavedTime() {
    const raw = sessionStorage.getItem(STORAGE_TIME_KEY);
    const parsed = raw ? parseFloat(raw) : 0;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }

  function saveCurrentTime() {
    let time = 0;
    if (activeMode === 'youtube' && ytReady && ytPlayer && typeof ytPlayer.getCurrentTime === 'function') {
      time = ytPlayer.getCurrentTime() || 0;
    } else if (activeMode === 'local' && localAudio) {
      time = localAudio.currentTime || 0;
    }
    if (time > 0) {
      sessionStorage.setItem(STORAGE_TIME_KEY, String(time));
    }
  }

  function playMusic(fromUserButton = false) {
    if (activeMode === 'local' && localAudio) {
      localAudio.volume = DEFAULT_VOLUME / 100;
      localAudio.play()
        .then(() => {
          isPlaying = true;
          pendingPlay = false;
          updateButtonUI();
        })
        .catch(() => {
          isPlaying = false;
          updateButtonUI();
        });
      return;
    }

    if (activeMode === 'youtube') {
      if (ytReady && ytPlayer && typeof ytPlayer.playVideo === 'function') {
        ytPlayer.setVolume(DEFAULT_VOLUME);
        ytPlayer.playVideo();
      } else {
        pendingPlay = true;
        updateButtonUI();
      }
      return;
    }

    if (fromUserButton) {
      showFallbackToast();
    }
  }

  function pauseMusic() {
    pendingPlay = false;
    isPlaying = false;
    if (activeMode === 'local' && localAudio) {
      localAudio.pause();
    } else if (activeMode === 'youtube' && ytReady && ytPlayer && typeof ytPlayer.pauseVideo === 'function') {
      ytPlayer.pauseVideo();
    }
    updateButtonUI();
  }

  function tryLocalFallback(onFail) {
    if (!localAudio) {
      localAudio = new Audio(LOCAL_AUDIO_SRC);
      localAudio.loop = true;
      localAudio.preload = 'auto';
    }

    const handleCanPlay = () => {
      cleanup();
      activeMode = 'local';
      const savedTime = getSavedTime();
      if (savedTime > 0 && localAudio.duration && savedTime < localAudio.duration) {
        localAudio.currentTime = savedTime;
      }
      if (!isMutedByUser() && (hasUserInteracted || pendingPlay)) {
        playMusic();
      }
    };

    const handleError = () => {
      cleanup();
      activeMode = 'unavailable';
      isPlaying = false;
      pendingPlay = false;
      updateButtonUI();
      if (onFail) onFail();
    };

    function cleanup() {
      localAudio.removeEventListener('canplaythrough', handleCanPlay);
      localAudio.removeEventListener('error', handleError);
    }

    localAudio.addEventListener('canplaythrough', handleCanPlay);
    localAudio.addEventListener('error', handleError);
    localAudio.load();
  }

  function showFallbackToast() {
    if (document.getElementById('musicFallbackToast')) {
      document.getElementById('musicFallbackToast').hidden = false;
      return;
    }

    const toast = document.createElement('div');
    toast.id = 'musicFallbackToast';
    toast.className = 'music-fallback-toast';
    toast.innerHTML = `
      <div class="music-toast-header">
        <span>🎵 Фоновая музыка (OST)</span>
        <button type="button" class="music-toast-close" aria-label="Закрыть">✕</button>
      </div>
      <p class="music-toast-text">
        Браузер заблокировал YouTube-плеер (обычно при открытии через <code>file://</code>).
        Запустите сайт через локальный сервер или выберите локальный аудиофайл:
      </p>
      <div class="music-toast-actions">
        <label class="music-toast-btn">
          Выбрать MP3 / OGG
          <input type="file" accept="audio/*" hidden id="customAudioPicker">
        </label>
        <a class="music-toast-link" href="https://www.youtube.com/watch?v=${YT_VIDEO_ID}" target="_blank" rel="noopener">
          Открыть OST
        </a>
      </div>
    `;

    document.body.appendChild(toast);

    toast.querySelector('.music-toast-close').addEventListener('click', () => {
      toast.hidden = true;
    });

    const picker = toast.querySelector('#customAudioPicker');
    picker.addEventListener('change', (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;

      const objectUrl = URL.createObjectURL(file);
      if (localAudio) {
        localAudio.pause();
      }
      localAudio = new Audio(objectUrl);
      localAudio.loop = true;
      activeMode = 'local';
      setMutedByUser(false);
      toast.hidden = true;
      playMusic();
    });
  }

  function initYouTubePlayer() {
    const wrap = document.createElement('div');
    wrap.id = 'yt-bg-player-wrap';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.style.cssText = 'position:fixed;left:-9999px;bottom:0;width:200px;height:200px;opacity:0.01;pointer-events:none;overflow:hidden;';

    const playerEl = document.createElement('div');
    playerEl.id = 'yt-bg-player';
    wrap.appendChild(playerEl);
    document.body.appendChild(wrap);

    const playerVars = {
      autoplay: 0,
      controls: 0,
      disablekb: 1,
      fs: 0,
      loop: 1,
      playlist: YT_VIDEO_ID,
      modestbranding: 1,
      rel: 0
    };

    if (window.location.protocol.startsWith('http')) {
      playerVars.origin = window.location.origin;
    }

    window.onYouTubeIframeAPIReady = () => {
      ytPlayer = new window.YT.Player('yt-bg-player', {
        height: '200',
        width: '200',
        videoId: YT_VIDEO_ID,
        playerVars,
        events: {
          onReady: (event) => {
            ytReady = true;
            event.target.setVolume(DEFAULT_VOLUME);
            const savedTime = getSavedTime();
            if (savedTime > 0 && typeof event.target.seekTo === 'function') {
              event.target.seekTo(savedTime, true);
            }
            if (!isMutedByUser() && (pendingPlay || hasUserInteracted)) {
              playMusic();
            }
          },
          onStateChange: (event) => {
            if (!window.YT) return;
            if (event.data === window.YT.PlayerState.PLAYING) {
              isPlaying = true;
              pendingPlay = false;
              updateButtonUI();
            } else if (event.data === window.YT.PlayerState.PAUSED) {
              isPlaying = false;
              pendingPlay = false;
              updateButtonUI();
            } else if (event.data === window.YT.PlayerState.ENDED) {
              event.target.seekTo(0, true);
              event.target.playVideo();
            }
          },
          onError: () => {
            ytReady = false;
            tryLocalFallback(() => {
              if (pendingPlay) showFallbackToast();
            });
          }
        }
      });
    };

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.onerror = () => {
      tryLocalFallback(() => {
        if (pendingPlay) showFallbackToast();
      });
    };
    document.head.appendChild(tag);
  }

  // Кнопка в шапке
  audioToggle.addEventListener('click', (event) => {
    event.stopPropagation();
    hasUserInteracted = true;

    if (isPlaying || pendingPlay) {
      setMutedByUser(true);
      pauseMusic();
    } else {
      setMutedByUser(false);
      playMusic(true);
    }
  });

  // Автозапуск при первом взаимодействии со страницей, если пользователь не отключал музыку
  function handleFirstInteraction() {
    hasUserInteracted = true;
    if (!isMutedByUser() && !isPlaying) {
      playMusic();
    }
    window.removeEventListener('pointerdown', handleFirstInteraction);
    window.removeEventListener('keydown', handleFirstInteraction);
  }

  window.addEventListener('pointerdown', handleFirstInteraction, { passive: true });
  window.addEventListener('keydown', handleFirstInteraction, { passive: true });
  window.addEventListener('pagehide', saveCurrentTime);
  window.addEventListener('beforeunload', saveCurrentTime);

  updateButtonUI();
  initYouTubePlayer();
})();
