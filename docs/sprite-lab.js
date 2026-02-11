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

function isBgPixel(data, width, x, y, bg, tolerance = 0) {
  const p = (y * width + x) * 4;
  const r = data[p];
  const g = data[p + 1];
  const b = data[p + 2];
  return (
    Math.abs(r - bg[0]) <= tolerance
    && Math.abs(g - bg[1]) <= tolerance
    && Math.abs(b - bg[2]) <= tolerance
  );
}

function rowIsUniformBg(data, width, y, bg, tolerance) {
  for (let x = 0; x < width; x += 1) {
    if (!isBgPixel(data, width, x, y, bg, tolerance)) {
      return false;
    }
  }
  return true;
}

function colIsUniformBg(data, width, y1, y2, x, bg, tolerance) {
  for (let y = y1; y <= y2; y += 1) {
    if (!isBgPixel(data, width, x, y, bg, tolerance)) {
      return false;
    }
  }
  return true;
}

function detectRowSegments(data, width, height, bg, tolerance = 0) {
  const rows = [];
  let y = 0;

  while (y < height) {
    while (y < height && rowIsUniformBg(data, width, y, bg, tolerance)) {
      y += 1;
    }
    if (y >= height) {
      break;
    }

    const start = y;

    while (y < height && !rowIsUniformBg(data, width, y, bg, tolerance)) {
      y += 1;
    }

    let end;
    if (y >= height) {
      end = height - 1;
    } else {
      end = Math.min(height - 1, y + 2);
      y = end + 1;
    }

    if (end - start + 1 >= 12) {
      rows.push([start, end]);
    }
  }

  return rows;
}

function detectColSegments(data, width, y1, y2, bg, tolerance = 0) {
  const cols = [];
  let x = 0;

  while (x < width) {
    while (x < width && colIsUniformBg(data, width, y1, y2, x, bg, tolerance)) {
      x += 1;
    }
    if (x >= width) {
      break;
    }

    const start = x;

    while (x < width && !colIsUniformBg(data, width, y1, y2, x, bg, tolerance)) {
      x += 1;
    }

    let end;
    if (x >= width) {
      end = width - 1;
    } else {
      end = Math.min(width - 1, x + 2);
      x = end + 1;
    }

    if (end - start + 1 >= 8) {
      cols.push([start, end]);
    }
  }

  return cols;
}

function extractActions(img) {
  const off = document.createElement('canvas');
  off.width = img.width;
  off.height = img.height;
  const offCtx = off.getContext('2d', { willReadFrequently: true });
  offCtx.drawImage(img, 0, 0);

  const { data, width, height } = offCtx.getImageData(0, 0, img.width, img.height);
  const bg = [data[0], data[1], data[2]];

  let rowSegments = detectRowSegments(data, width, height, bg, 0);
  if (rowSegments.length === 0) {
    rowSegments = detectRowSegments(data, width, height, bg, 8);
  }

  const actions = [];

  rowSegments.forEach(([y1, y2], rowIndex) => {
    let colSegments = detectColSegments(data, width, y1, y2, bg, 0);
    if (colSegments.length === 0) {
      colSegments = detectColSegments(data, width, y1, y2, bg, 8);
    }

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

  return { actions, bg };
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

  const result = extractActions(img);
  state.actions = result.actions;

  meta.textContent = JSON.stringify({
    source: 'scan same-rgb line -> different -> same line, cut at +2',
    backgroundRgb: result.bg,
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
