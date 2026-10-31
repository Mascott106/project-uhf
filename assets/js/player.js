document.addEventListener('DOMContentLoaded', initApp);

let loadToken = 0;
let channelStatic = null;

const STATIC_MIN_MS = 680;
const STATIC_MIN_REDUCED_MS = 220;

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
  const controls = ui.getControls();
  // A reload drops this page, but the TV keeps playing. Stop the session
  // so the next cast is the only one on that device.
  window.addEventListener('pagehide', () => {
    const proxy = controls.getCastProxy();
    if (proxy && proxy.isCasting()) {
      proxy.forceDisconnect();
    }
  });
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

  controls.getPlayer().addEventListener('error', (event) => {
    if (isStaleLoadError(event.detail)) {
      return;
    }
    showError(event.detail);
  });

  channelStatic = createChannelStatic(document.getElementById('channel-static'));

  let selectedId = streams[0].id;
  const picker = document.querySelector('.stream-list');

  if (picker) {
    const selectStream = (id) => {
      if (id === selectedId) {
        return;
      }
      selectedId = id;
      markSelected(picker, id);
      loadStream(player, video, streams, id, config.autoplay, true, controls);
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

  await loadStream(player, video, streams, selectedId, config.autoplay, false, controls);
}

async function loadStream(player, video, streams, id, autoplay, withStatic, controls) {
  const token = ++loadToken;
  const stream = streams.find((item) => item.id === id);
  const casting = isCasting(controls);

  if (!stream || !stream.manifestUrl) {
    showError('Could not load the video.');
    if (withStatic) {
      channelStatic.hide();
    }
    return;
  }

  if (casting) {
    // The browser video is only a local copy. Pause it so a switch cannot
    // start a second stream here while the TV keeps the old one.
    video.pause();
    if (player.getAssetUri()) {
      await player.unload();
    }
    if (token !== loadToken) {
      return;
    }
  } else if (withStatic) {
    video.pause();
    channelStatic.show(stream.label);
  }

  try {
    await controls.getPlayer().load(stream.manifestUrl);
    if (token !== loadToken) {
      return;
    }
    hideError();
    if (autoplay) {
      if (casting) {
        await controls.getVideo().play();
      } else {
        await startPlayback(video);
      }
    }
    if (token !== loadToken) {
      return;
    }
    if (withStatic && !casting) {
      await channelStatic.finish(token, video);
    }
  } catch (error) {
    if (token !== loadToken || isStaleLoadError(error)) {
      return;
    }
    showError(error);
    if (withStatic) {
      channelStatic.hide();
    }
  }
}

function isCasting(controls) {
  const proxy = controls && controls.getCastProxy();
  return !!(proxy && proxy.isCasting());
}

function createChannelStatic(overlay) {
  const canvas = overlay.querySelector('canvas');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ctx = canvas.getContext('2d', { alpha: false });
  let running = false;
  let frame = 0;
  let frameToken = 0;
  let shownAt = 0;

  function draw(token) {
    if (!running || token !== frameToken) {
      return;
    }

    const bounds = overlay.getBoundingClientRect();
    const width = Math.max(2, Math.round(bounds.width / 6));
    const height = Math.max(2, Math.round(bounds.height / 6));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const image = ctx.createImageData(width, height);
    const data = image.data;
    for (let i = 0; i < data.length; i += 4) {
      const snow = Math.random() < 0.5
        ? (Math.random() * 70) | 0
        : 150 + ((Math.random() * 105) | 0);
      data[i] = snow;
      data[i + 1] = snow;
      data[i + 2] = snow;
      data[i + 3] = 255;
    }

    const band = (frame * 3) % height;
    const bandHeight = Math.max(2, (height / 8) | 0);
    for (let y = band; y < band + bandHeight && y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixel = (y * width + x) * 4;
        const bright = 200 + ((Math.random() * 55) | 0);
        data[pixel] = bright;
        data[pixel + 1] = bright;
        data[pixel + 2] = bright;
      }
    }

    ctx.putImageData(image, 0, 0);
    frame += 1;
    requestAnimationFrame(() => draw(token));
  }

  return {
    show(label) {
      const name = overlay.querySelector('.channel-name');
      if (name) {
        name.textContent = label || '';
      }
      shownAt = performance.now();
      overlay.hidden = false;
      overlay.classList.remove('is-on');
      void overlay.offsetWidth;
      overlay.classList.toggle('is-still', reduceMotion);
      overlay.classList.add('is-on');
      if (reduceMotion || running) {
        return;
      }
      running = true;
      const token = ++frameToken;
      requestAnimationFrame(() => draw(token));
    },

    async finish(token, video) {
      const startedAt = shownAt;
      await waitForPicture(video, token);
      if (token !== loadToken) {
        return;
      }
      const minMs = reduceMotion ? STATIC_MIN_REDUCED_MS : STATIC_MIN_MS;
      const remaining = minMs - (performance.now() - startedAt);
      if (remaining > 0) {
        await sleep(remaining);
      }
      if (token !== loadToken) {
        return;
      }
      this.hide();
    },

    hide() {
      running = false;
      frameToken += 1;
      overlay.classList.remove('is-on', 'is-still');
      overlay.hidden = true;
    },
  };
}

function waitForPicture(video, token) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      video.removeEventListener('loadeddata', onReady);
      video.removeEventListener('playing', onReady);
      clearTimeout(timer);
      resolve();
    };
    const onReady = () => {
      if (token !== loadToken || video.readyState >= 2) {
        finish();
      }
    };
    const timer = setTimeout(finish, 4000);
    video.addEventListener('loadeddata', onReady);
    video.addEventListener('playing', onReady);

    if (video.readyState >= 2 && video.paused) {
      requestAnimationFrame(finish);
      return;
    }

    if (typeof video.requestVideoFrameCallback === 'function') {
      video.requestVideoFrameCallback(() => finish());
      return;
    }

    if (video.readyState >= 2) {
      requestAnimationFrame(() => requestAnimationFrame(finish));
    }
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
