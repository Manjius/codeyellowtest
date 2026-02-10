const SPRITE_SHEET_URL = TAOPAIPAI_SPRITESHEET_DATA_URL;

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

function pixelIsBackground(r, g, b, bg, tolerance = 28) {
  return (
    Math.abs(r - bg[0]) <= tolerance
    && Math.abs(g - bg[1]) <= tolerance
    && Math.abs(b - bg[2]) <= tolerance
  );
}

function contiguousRanges(values) {
  const ranges = [];
  let start = -1;

  values.forEach((isFilled, i) => {
    if (isFilled && start === -1) {
      start = i;
    }
    if (!isFilled && start !== -1) {
      ranges.push([start, i - 1]);
      start = -1;
    }
  });

  if (start !== -1) {
    ranges.push([start, values.length - 1]);
  }

  return ranges;
}

function extractSprites(img) {
  const off = document.createElement('canvas');
  off.width = img.width;
  off.height = img.height;
  const offCtx = off.getContext('2d', { willReadFrequently: true });
  offCtx.drawImage(img, 0, 0);

  const { data, width, height } = offCtx.getImageData(0, 0, img.width, img.height);
  const bg = [data[0], data[1], data[2]];
  const sprites = [];

  const cellW = 60;
  const cellH = 60;

  for (let top = 0; top < height; top += cellH) {
    for (let left = 0; left < width; left += cellW) {
      const right = Math.min(width - 1, left + cellW - 1);
      const bottom = Math.min(height - 1, top + cellH - 1);

      let minX = width;
      let minY = height;
      let maxX = -1;
      let maxY = -1;

      for (let y = top; y <= bottom; y += 1) {
        for (let x = left; x <= right; x += 1) {
          const p = (y * width + x) * 4;
          const r = data[p];
          const g = data[p + 1];
          const b = data[p + 2];
          const a = data[p + 3];

          if (a !== 0 && !pixelIsBackground(r, g, b, bg)) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
        }
      }

      if (maxX >= minX && maxY >= minY) {
        const w = maxX - minX + 1;
        const h = maxY - minY + 1;

        if (w >= 8 && h >= 8 && w <= 120 && h <= 120) {
          sprites.push({ x: minX, y: minY, w, h, cy: minY + h / 2 });
        }
      }
    }
  }

  sprites.sort((a, b) => (a.y - b.y) || (a.x - b.x));
  return sprites;
}

function groupByRows(boxes) {
  const rows = [];
  const threshold = 20;

  for (const box of boxes) {
    const row = rows.find((candidate) => Math.abs(candidate.cy - box.cy) <= threshold);
    if (row) {
      row.frames.push(box);
      row.cy = (row.cy * (row.frames.length - 1) + box.cy) / row.frames.length;
    } else {
      rows.push({ cy: box.cy, frames: [box] });
    }
  }

  rows.forEach((row) => {
    row.frames.sort((a, b) => a.x - b.x);
  });

  return rows.filter((row) => row.frames.length >= 2 && row.frames.length <= 16);
}

function drawFrame(frame) {
  const pad = 12;
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
  for (const [buttonIndex, button] of Array.from(actionButtons.children).entries()) {
    button.classList.toggle('active', buttonIndex === index);
  }

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

  const sprites = extractSprites(img);
  const rows = groupByRows(sprites);

  state.actions = rows.map((row, i) => ({
    name: `Action ${String(i + 1).padStart(2, '0')}`,
    frames: row.frames,
  }));

  meta.textContent = JSON.stringify({
    totalSprites: sprites.length,
    totalActions: state.actions.length,
    actions: state.actions.map((action) => ({
      name: action.name,
      frames: action.frames.length,
    })),
  }, null, 2);

  renderButtons();
  playAction(0);
}

speedInput.addEventListener('input', () => {
  state.frameDelay = Number(speedInput.value);
  speedValue.textContent = `${state.frameDelay}ms`;
  playAction(state.currentActionIndex);
});

init();
