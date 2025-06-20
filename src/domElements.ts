// HTML要素の取得
export const gameCanvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
export const nextCanvas = document.getElementById('nextCanvas') as HTMLCanvasElement;
export const holdCanvas = document.getElementById('holdCanvas') as HTMLCanvasElement;
export const scoreElement = document.getElementById('score') as HTMLElement;
export const levelDisplayElement = document.getElementById('levelDisplay') as HTMLElement;
export const multiplierDisplayElement = document.getElementById('multiplierDisplay') as HTMLElement;
export const startButton = document.getElementById('startButton') as HTMLButtonElement;

// 2Dコンテキストの取得
export const gameCtx = gameCanvas.getContext('2d') as CanvasRenderingContext2D;
export const nextCtx = nextCanvas.getContext('2d') as CanvasRenderingContext2D;
export const holdCtx = holdCanvas.getContext('2d') as CanvasRenderingContext2D;

// BGMコントロール要素の取得
export const bgmAudio = document.getElementById('bgm_audio') as HTMLAudioElement | null;
export const playPauseButton = document.getElementById('play_pause_button') as HTMLButtonElement | null;
export const volumeSlider = document.getElementById('volume_slider') as HTMLInputElement | null;
