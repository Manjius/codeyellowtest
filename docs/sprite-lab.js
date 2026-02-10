const SPRITE_SHEET_URL = TRUNKS_SPRITESHEET_DATA_URL;

const stage = document.getElementById('stage');
const ctx = stage.getContext('2d');
ctx.imageSmoothingEnabled = false;

const actionButtons = document.getElementById('actionButtons');
const speedInput = document.getElementById('speed');
const speedValue = document.getElementById('speedValue');
const meta = document.getElementById('meta');

const state = {
  actions: [],
  currentActionIndex: 0,
  frameIndex: 0,
  timer: null,
  frameDelay: Number(speedInput.value),
  sheet: null,
};

function pixelIsBackground(r, g, b, bg, tolerance = 10) {
  return (
    Math.abs(r - bg[0]) <= tolerance
    && Math.abs(g - bg[1]) <= tolerance
    && Math.abs(b - bg[2]) <= tolerance
  );
}

function buildMonochromeMasks(imageData, bg) {
  const { data, width, height } = imageData;
  const rowIsMono = new Array(height).fill(true);
  const colIsMono = new Array(width).fill(true);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const p = (y * width + x) * 4;
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];
      const a = data[p + 3];
      const isBg = a === 0 || pixelIsBackground(r, g, b, bg);
      if (!isBg) {
        rowIsMono[y] = false;
        colIsMono[x] = false;
      }
    }
  }

  return { rowIsMono, colIsMono };
}

function getRuns(mask, targetValue) {
  const runs = [];
  let start = -1;

  for (let i = 0; i < mask.length; i += 1) {
    if (mask[i] === targetValue && start === -1) {
      start = i;
    }
    if (mask[i] !== targetValue && start !== -1) {
      runs.push([start, i - 1]);
      start = -1;
    }
  }

  if (start !== -1) {
    runs.push([start, mask.length - 1]);
  }

  return runs;
}

function splitByMonochromeMidlines(contentRuns, dividerRuns, maxLimit) {
  if (contentRuns.length === 0) {
    return [];
  }

  const boundaries = [contentRuns[0][0]];

  for (let i = 0; i < contentRuns.length - 1; i += 1) {
    const leftEnd = contentRuns[i][1];
    const rightStart = contentRuns[i + 1][0];

    const divider = dividerRuns.find(([a, b]) => a <= rightStart && b >= leftEnd);
    const mid = divider ? Math.floor((divider[0] + divider[1]) / 2) : Math.floor((leftEnd + rightStart) / 2);
    boundaries.push(mid);
  }

  boundaries.push(contentRuns[contentRuns.length - 1][1]);

  const segments = [];
  for (let i = 0; i < contentRuns.length; i += 1) {
    const x1 = i === 0 ? boundaries[0] : boundaries[i] + 1;
    const x2 = i === contentRuns.length - 1 ? boundaries[boundaries.length - 1] : boundaries[i + 1];
    if (x2 >= x1 && x1 >= 0 && x2 <= maxLimit) {
      segments.push([x1, x2]);
    }
  }

  return segments;
}

function extractSpritesByGrid(img) {
  const off = document.createElement('canvas');
  off.width = img.width;
  off.height = img.height;
  const offCtx = off.getContext('2d', { willReadFrequently: true });
  offCtx.drawImage(img, 0, 0);

  const imageData = offCtx.getImageData(0, 0, img.width, img.height);
  const { data, width, height } = imageData;
  const bg = [data[0], data[1], data[2]];

  const { rowIsMono } = buildMonochromeMasks(imageData, bg);
  const monoRowRuns = getRuns(rowIsMono, true).filter(([a, b]) => (b - a + 1) >= 2);
  const rowContentRuns = getRuns(rowIsMono, false);
  const rowSegments = splitByMonochromeMidlines(rowContentRuns, monoRowRuns, height - 1)
    .filter(([y1, y2]) => (y2 - y1 + 1) >= 12);

  const actions = [];

  rowSegments.forEach(([y1, y2], rowIndex) => {
    const colIsMonoInRow = new Array(width).fill(true);

    for (let x = 0; x < width; x += 1) {
      for (let y = y1; y <= y2; y += 1) {
        const p = (y * width + x) * 4;
        const r = data[p];
        const g = data[p + 1];
        const b = data[p + 2];
        const a = data[p + 3];
        const isBg = a === 0 || pixelIsBackground(r, g, b, bg);
        if (!isBg) {
          colIsMonoInRow[x] = false;
          break;
        }
      }
    }

    const monoColRuns = getRuns(colIsMonoInRow, true).filter(([a, b]) => (b - a + 1) >= 2);
    const colContentRuns = getRuns(colIsMonoInRow, false);
    const colSegments = splitByMonochromeMidlines(colContentRuns, monoColRuns, width - 1)
      .filter(([x1, x2]) => (x2 - x1 + 1) >= 8);

    const frames = colSegments.map(([x1, x2]) => ({
      x: x1,
      y: y1,
      w: x2 - x1 + 1,
      h: y2 - y1 + 1,
    }));

    if (frames.length >= 2) {
      actions.push({
        name: `Row ${String(rowIndex + 1).padStart(2, '0')}`,
        frames,
      });
    }
  });

  return actions;
}

function drawFrame(frame) {
  const pad = 10;
  ctx.clearRect(0, 0, stage.width, stage.height);
  ctx.fillStyle = '#16171f';
  ctx.fillRect(0, 0, stage.width, stage.height);

  const scale = Math.max(1, Math.floor(Math.min((stage.width - pad * 2) / frame.w, (stage.height - pad * 2) / frame.h)));
  const drawW = frame.w * scale;
  const drawH = frame.h * scale;
  const dx = Math.floor((stage.width - drawW) / 2);
  const dy = Math.floor((stage.height - drawH) / 2);

  ctx.drawImage(state.sheet, frame.x, frame.y, frame.w, frame.h, dx, dy, drawW, drawH);
}

function playAction(index) {
  state.currentActionIndex = index;
  state.frameIndex = 0;

  Array.from(actionButtons.children).forEach((button, buttonIndex) => {
    button.classList.toggle('active', buttonIndex === index);
  });

  if (state.timer) {
    clearInterval(state.timer);
  }

  const action = state.actions[index];
  drawFrame(action.frames[state.frameIndex]);

  state.timer = setInterval(() => {
    state.frameIndex = (state.frameIndex + 1) % action.frames.length;
    drawFrame(action.frames[state.frameIndex]);
  }, state.frameDelay);
}

function renderButtons() {
  actionButtons.textContent = '';
  state.actions.forEach((action, index) => {
    const button = document.createElement('button');
    button.textContent = `${action.name} (${action.frames.length})`;
    button.addEventListener('click', () => playAction(index));
    actionButtons.appendChild(button);
  });
}

async function init() {
  const img = new Image();
  img.src = SPRITE_SHEET_URL;
  await img.decode();
  state.sheet = img;

  state.actions = extractSpritesByGrid(img);

  meta.textContent = JSON.stringify({
    source: 'monochrome row/column dividers',
    totalActions: state.actions.length,
    actions: state.actions.map((action) => ({
      name: action.name,
      frames: action.frames.length,
      frameSize: `${action.frames[0].w}x${action.frames[0].h}`,
    })),
  }, null, 2);

  renderButtons();
  if (state.actions.length > 0) {
    playAction(0);
  }
}

speedInput.addEventListener('input', () => {
  state.frameDelay = Number(speedInput.value);
  speedValue.textContent = `${state.frameDelay}ms`;
  if (state.actions.length > 0) {
    playAction(state.currentActionIndex);
  }
});

init();
