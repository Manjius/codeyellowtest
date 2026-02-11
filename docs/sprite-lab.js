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

function extractActions(img) {
  const width = img.width;
  const height = img.height;

  const totalColumns = 16;
  const totalRows = 23;

  const baseCellW = Math.floor(width / totalColumns);
  const baseCellH = Math.floor(height / totalRows);
  const extraW = width % totalColumns;
  const extraH = height % totalRows;

  const columnBounds = [];
  let xCursor = 0;
  for (let col = 0; col < totalColumns; col += 1) {
    const w = baseCellW + (col < extraW ? 1 : 0);
    columnBounds.push([xCursor, xCursor + w - 1]);
    xCursor += w;
  }

  const rowBounds = [];
  let yCursor = 0;
  for (let row = 0; row < totalRows; row += 1) {
    const h = baseCellH + (row < extraH ? 1 : 0);
    rowBounds.push([yCursor, yCursor + h - 1]);
    yCursor += h;
  }

  const actions = rowBounds.map(([y1, y2], rowIndex) => ({
    name: `Row ${String(rowIndex + 1).padStart(2, '0')}`,
    frames: columnBounds.map(([x1, x2]) => ({
      x: x1,
      y: y1,
      w: x2 - x1 + 1,
      h: y2 - y1 + 1,
    })),
  }));

  return {
    actions,
    grid: {
      rows: totalRows,
      columns: totalColumns,
      cellWidth: baseCellW,
      cellHeight: baseCellH,
      extraWidthPixels: extraW,
      extraHeightPixels: extraH,
    },
  };
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
    source: 'fixed grid split (23 rows x 16 columns)',
    grid: result.grid,
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
