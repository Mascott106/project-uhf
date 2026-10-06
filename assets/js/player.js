document.addEventListener('DOMContentLoaded', initApp);

function initApp() {
  shaka.polyfill.installAll();

  if (!shaka.Player.isBrowserSupported()) {
    showError('This browser cannot play the stream.');
    return;
  }

  initPlayer();
}

async function initPlayer() {
  const container = document.getElementById('player');
  const video = document.getElementById('video');
  const manifestUrl = container.dataset.manifestUrl;
  const castReceiverAppId = container.dataset.castReceiverAppId;

  if (!manifestUrl) {
    showError('Could not load the video.');
    return;
  }

  const player = new shaka.Player();
  await player.attach(video);

  const ui = new shaka.ui.Overlay(player, container, video);
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
    showError(event.detail);
  });

  try {
    await player.load(manifestUrl);
    await startPlayback(video);
  } catch (error) {
    showError(error);
  }
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
