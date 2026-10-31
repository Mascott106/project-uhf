document.addEventListener('DOMContentLoaded', initApp);

let loadToken = 0;

function initApp() {
  shaka.polyfill.installAll();

  if (!shaka.Player.isBrowserSupported()) {
    showError('This browser cannot play the stream.');
    return;
  }

  initPlayer();
}

async function initPlayer() {
  const video = document.getElementById('video');
  const config = JSON.parse(document.getElementById('player-config').textContent);
  const streams = Array.isArray(config.streams) ? config.streams : [];
  const castReceiverAppId = config.castReceiverAppId;

  if (!streams.length || !streams[0].manifestUrl) {
    showError('Could not load the video.');
    return;
  }

  const player = new shaka.Player();
  await player.attach(video);

  const ui = new shaka.ui.Overlay(player, document.getElementById('player'), video);
  ui.configure({
    addSeekBar: true,
    castReceiverAppId: castReceiverAppId,
    controlPanelElements: [
      'play_pause',
      'time_and_duration',
      'spacer',
      'mute',
      'volume',
      'captions',
      'remote',
      'cast',
      'fullscreen',
      'overflow_menu',
    ],
    overflowMenuButtons: [
      'quality',
      'language',
      'playback_rate',
      'captions-position',
      'captions-size',
    ],
  });

  player.addEventListener('error', (event) => {
    if (isStaleLoadError(event.detail)) {
      return;
    }
    showError(event.detail);
  });

  let selectedId = streams[0].id;
  const picker = document.querySelector('.stream-list');

  if (picker) {
    const selectStream = (id) => {
      if (id === selectedId) {
        return;
      }
      selectedId = id;
      markSelected(picker, id);
      loadStream(player, video, streams, id, config.autoplay);
    };

    picker.addEventListener('click', (event) => {
      const button = event.target.closest('[data-stream-id]');
      if (!button || !picker.contains(button)) {
        return;
      }
      selectStream(button.dataset.streamId);
    });

    picker.addEventListener('keydown', (event) => {
      const buttons = [...picker.querySelectorAll('[data-stream-id]')];
      const current = buttons.findIndex((button) => button.getAttribute('aria-checked') === 'true');
      if (current < 0) {
        return;
      }

      let next = current;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        next = (current + 1) % buttons.length;
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        next = (current - 1 + buttons.length) % buttons.length;
      } else {
        return;
      }

      event.preventDefault();
      buttons[next].focus();
      selectStream(buttons[next].dataset.streamId);
    });
  }

  await loadStream(player, video, streams, selectedId, config.autoplay);
}

async function loadStream(player, video, streams, id, autoplay) {
  const token = ++loadToken;
  const stream = streams.find((item) => item.id === id);

  if (!stream || !stream.manifestUrl) {
    showError('Could not load the video.');
    return;
  }

  try {
    await player.load(stream.manifestUrl);
    if (token !== loadToken) {
      return;
    }
    hideError();
    if (autoplay) {
      await startPlayback(video);
    }
  } catch (error) {
    if (token !== loadToken || isStaleLoadError(error)) {
      return;
    }
    showError(error);
  }
}

function markSelected(picker, id) {
  for (const button of picker.querySelectorAll('[data-stream-id]')) {
    button.setAttribute('aria-checked', button.dataset.streamId === id ? 'true' : 'false');
  }
}

function isStaleLoadError(error) {
  if (!error || !shaka.util || !shaka.util.Error || !shaka.util.Error.Code) {
    return false;
  }
  const code = error.code;
  return code === shaka.util.Error.Code.LOAD_INTERRUPTED
    || code === shaka.util.Error.Code.OPERATION_ABORTED;
}

async function startPlayback(video) {
  try {
    await video.play();
  } catch (error) {
    if (!error || error.name !== 'NotAllowedError') {
      return;
    }
    video.muted = true;
    try {
      await video.play();
    } catch (playError) {
      // Leave the play button available when the browser still blocks playback.
    }
  }
}

function showError(error) {
  const el = document.getElementById('player-error');
  el.textContent = typeof error === 'string' ? error : 'Could not load the video.';
  el.hidden = false;
  if (error && typeof error !== 'string') {
    console.error(error);
  }
}

function hideError() {
  const el = document.getElementById('player-error');
  el.textContent = '';
  el.hidden = true;
}
