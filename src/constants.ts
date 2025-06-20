// ゲームの定数
export const COLS: number = 10; // ボードの列数
export const ROWS: number = 20; // ボードの行数
export const BLOCK_SIZE: number = 30; // 1ブロックのサイズ (ピクセル)
export const NEXT_BLOCK_SIZE: number = 30; // 次のブロック表示エリアのブロックサイズ
export const HOLD_BLOCK_SIZE: number = 30; // 追加 (NEXT_BLOCK_SIZE と同じ値)

// テトリミノの色
export const COLORS: (string | null)[] = [
    null,        // 0: 空白セル
    '#FF0D72', // 1: I (赤紫)
    '#0DC2FF', // 2: L (青)
    '#0DFF72', // 3: J (緑)
    '#F538FF', // 4: T (紫)
    '#FF8E0D', // 5: O (オレンジ)
    '#FFE138', // 6: S (黄)
    '#3877FF'  // 7: Z (藍色)
];

// テトリミノの形状
export const TETROMINOS: number[][][] = [
    // I字
    [[1, 1, 1, 1]],
    // L字
    [[2, 0, 0], [2, 2, 2]],
    // J字 (L字の反対)
    [[0, 0, 3], [3, 3, 3]],
    // T字
    [[0, 4, 0], [4, 4, 4]],
    // O字 (正方形)
    [[5, 5], [5, 5]],
    // S字
    [[0, 6, 6], [6, 6, 0]],
    // Z字 (S字の反対)
    [[7, 7, 0], [0, 7, 7]]
];

export const MIN_GAME_SPEED: number = 100; // 落下速度の最低値（これ以上速くならない）
export const GAME_SPEED_DECREMENT: number = 50; // レベルアップごとに減少する速度
export const SCORE_MULTIPLIER_INCREMENT: number = 0.5; // レベルアップごとに増加するスコア倍率
