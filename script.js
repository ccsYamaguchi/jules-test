// HTML要素の取得
const gameCanvas = document.getElementById('gameCanvas');
const nextCanvas = document.getElementById('nextCanvas');
const scoreElement = document.getElementById('score');
const startButton = document.getElementById('startButton');

// 2Dコンテキストの取得
const gameCtx = gameCanvas.getContext('2d');
const nextCtx = nextCanvas.getContext('2d');

// ゲームの定数
const COLS = 10; // ボードの列数
const ROWS = 20; // ボードの行数
const BLOCK_SIZE = 30; // 1ブロックのサイズ (ピクセル)
const NEXT_BLOCK_SIZE = 30; // 次のブロック表示エリアのブロックサイズ

// テトリミノの色
const COLORS = [
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
const TETROMINOS = [
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

// ゲームの状態変数
let board = []; // ゲームボード (2次元配列)
let currentTetrimino = null; // 現在操作中のテトリミノ
let currentX = 0; // 現在のテトリミノのX座標 (左上の列)
let currentY = 0; // 現在のテトリミノのY座標 (左上の行)
let nextTetrimino = null; // 次に出現するテトリミノ
let score = 0; // 現在のスコア
let gameInterval = null; // ゲームループのインターバルID
let gameSpeed = 500; // テトリミノが1段落下する速度 (ミリ秒)

// --- ゲームロジック関数 ---

/**
 * ゲームボードを初期化する
 */
function initBoard() {
    for (let r = 0; r < ROWS; r++) {
        board[r] = [];
        for (let c = 0; c < COLS; c++) {
            board[r][c] = 0; // 0は空のセルを表す
        }
    }
}

/**
 * ランダムなテトリミノとその色を返す
 * @returns {{shape: number[][], color: string}} テトリミノの形状と色のオブジェクト
 */
function getRandomTetrimino() {
    const index = Math.floor(Math.random() * TETROMINOS.length);
    const shape = TETROMINOS[index];
    // 単純化のため、テトリミノの色はCOLORS配列のインデックス+1に基づいています
    // TETROMINOSとCOLORSが直接対応していない場合は、より直接的なマッピングが必要になることがあります
    return { shape: shape, color: COLORS[index + 1] };
}

/**
 * 指定されたコンテキストに1つのブロックを描画する
 * @param {CanvasRenderingContext2D} ctx - 描画コンテキスト
 * @param {number} x - ブロックのX座標 (列)
 * @param {number} y - ブロックのY座標 (行)
 * @param {string} color - ブロックの色
 * @param {number} blockSize - 1ブロックのサイズ
 */
function drawBlock(ctx, x, y, color, blockSize) {
    ctx.fillStyle = color;
    ctx.fillRect(x * blockSize, y * blockSize, blockSize, blockSize);
    ctx.strokeStyle = '#333'; // ブロックの境界線
    ctx.strokeRect(x * blockSize, y * blockSize, blockSize, blockSize);
}

/**
 * ゲームボード全体を描画する
 */
function drawBoard() {
    gameCtx.clearRect(0, 0, gameCanvas.width, gameCanvas.height); // キャンバスをクリア
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (board[r][c] !== 0) { // 空でないセルのみ描画
                drawBlock(gameCtx, c, r, COLORS[board[r][c]], BLOCK_SIZE);
            }
        }
    }
}

/**
 * 指定されたコンテキストにテトリミノを描画する
 * @param {CanvasRenderingContext2D} ctx - 描画コンテキスト
 * @param {{shape: number[][], color: string}} tetrimino - 描画するテトリミノ
 * @param {number} x - テトリミノのX座標 (左上の列)
 * @param {number} y - テトリミノのY座標 (左上の行)
 * @param {number} blockSize - 1ブロックのサイズ
 */
function drawTetrimino(ctx, tetrimino, x, y, blockSize) {
    if (!tetrimino) return;
    const shape = tetrimino.shape;
    const color = tetrimino.color;
    shape.forEach((row, r) => {
        row.forEach((value, c) => {
            if (value !== 0) { // テトリミノの形状がある部分のみ描画
                drawBlock(ctx, x + c, y + r, color, blockSize);
            }
        });
    });
}

/**
 * 次に出現するテトリミノを専用のキャンバスに描画する
 */
function drawNextTetrimino() {
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height); // 次のブロック表示エリアをクリア
    if (nextTetrimino) {
        // 次のテトリミノをnextCanvasの中央に配置する
        const shape = nextTetrimino.shape;
        const nextBlockSizeToDraw = NEXT_BLOCK_SIZE; // 次のキャンバス用のブロックサイズ

        // テトリミノの幅と高さを計算 (ブロック単位)
        let tetriminoPixelWidth = 0;
        if (shape[0]) {
            tetriminoPixelWidth = shape[0].length * nextBlockSizeToDraw;
        }
        const tetriminoPixelHeight = shape.length * nextBlockSizeToDraw;

        // 中央揃えのためのX, Y座標を計算 (ブロック単位)
        const x = (nextCanvas.width - tetriminoPixelWidth) / (2 * nextBlockSizeToDraw);
        const y = (nextCanvas.height - tetriminoPixelHeight) / (2 * nextBlockSizeToDraw);

        drawTetrimino(nextCtx, nextTetrimino, x, y, nextBlockSizeToDraw);
    }
}

/**
 * スコア表示を更新する
 */
function updateScore() {
    scoreElement.textContent = score;
}

/**
 * 新しいテトリミノを生成し、初期位置に配置する
 * ゲームオーバーのチェックもここで行う
 */
function spawnTetrimino() {
    currentTetrimino = nextTetrimino ? nextTetrimino : getRandomTetrimino();
    nextTetrimino = getRandomTetrimino();
    // テトリミノの形状に基づいて中央上部に配置
    currentX = Math.floor(COLS / 2) - Math.floor(currentTetrimino.shape[0].length / 2);
    currentY = 0; // 最上部に配置

    drawNextTetrimino(); // 次のテトリミノを表示更新

    // 出現位置で既に衝突している場合はゲームオーバー
    if (checkCollision(currentX, currentY, currentTetrimino.shape)) {
        gameOver();
    }
}

/**
 * テトリミノを1段下に移動させる
 * 衝突する場合はテトリミノを固定し、新しいテトリミノを生成する
 */
function moveDown() {
    if (!checkCollision(currentX, currentY + 1, currentTetrimino.shape)) {
        currentY++; // 衝突しなければ1段下へ
    } else {
        // 衝突する場合は現在の位置で固定
        placeTetrimino();
        clearLines(); // ラインが揃っていれば消去
        spawnTetrimino(); // 新しいテトリミノを生成
    }
    drawGame(); // ゲーム画面を再描画
}

/**
 * テトリミノを左に1列移動させる
 */
function moveLeft() {
    if (!checkCollision(currentX - 1, currentY, currentTetrimino.shape)) {
        currentX--; // 衝突しなければ1列左へ
    }
    drawGame(); // ゲーム画面を再描画
}

/**
 * テトリミノを右に1列移動させる
 */
function moveRight() {
    if (!checkCollision(currentX + 1, currentY, currentTetrimino.shape)) {
        currentX++; // 衝突しなければ1列右へ
    }
    drawGame(); // ゲーム画面を再描画
}

/**
 * テトリミノを時計回りに90度回転させる
 */
function rotateTetrimino() {
    const originalShape = currentTetrimino.shape;
    const N = originalShape.length; // 元の形状の行数
    const M = originalShape[0].length; // 元の形状の列数
    let newShape = [];

    // 回転処理 (行列の転置と逆順)
    for (let i = 0; i < M; i++) {
        newShape[i] = [];
        for (let j = 0; j < N; j++) {
            newShape[i][j] = originalShape[N - 1 - j][i];
        }
    }

    // 回転後に衝突しないかチェック
    if (!checkCollision(currentX, currentY, newShape)) {
        currentTetrimino.shape = newShape; // 衝突しなければ形状を更新
    }
    drawGame(); // ゲーム画面を再描画
}

/**
 * ハードドロップ機能: テトリミノを一番下まで落下させて固定する
 */
function hardDrop() {
    while (!checkCollision(currentX, currentY + 1, currentTetrimino.shape)) {
        currentY++; // 衝突するまで下に移動
    }
    placeTetrimino(); // テトリミノを固定
    clearLines();     // ライン消去処理
    spawnTetrimino(); // 新しいテトリミノを生成
    drawGame();       // ゲーム画面を再描画
}


/**
 * 指定された位置と形状でテトリミノが衝突するかどうかをチェックする
 * @param {number} x - チェックするX座標
 * @param {number} y - チェックするY座標
 * @param {number[][]} shape - チェックするテトリミノの形状
 * @returns {boolean} 衝突する場合はtrue、しない場合はfalse
 */
function checkCollision(x, y, shape) {
    for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
            if (shape[r][c] !== 0) { // テトリミノのブロックがある部分のみチェック
                const newX = x + c; // ブロックの実際のX座標
                const newY = y + r; // ブロックの実際のY座標

                // 壁との衝突チェック
                if (newX < 0 || newX >= COLS || newY >= ROWS) {
                    return true; // 壁または床に衝突
                }
                // 他の固定されたブロックとの衝突チェック (ボード上のみ)
                if (newY >= 0 && board[newY] && board[newY][newX] !== 0) {
                    return true; // 他のブロックに衝突
                }
            }
        }
    }
    return false; // 衝突なし
}

/**
 * 現在のテトリミノをボードに固定する
 */
function placeTetrimino() {
    const shape = currentTetrimino.shape;
    let colorIndex = COLORS.indexOf(currentTetrimino.color); // ボード記録用の色インデックスを取得

    // Guard against invalid colorIndex
    if (colorIndex === -1 || colorIndex === 0) {
        // console.warn(`Invalid color detected: ${currentTetrimino.color}. Defaulting to color index 1.`); // Optional for debugging
        colorIndex = 1; // Default to a visible color index
    }

    shape.forEach((row, r) => {
        row.forEach((value, c) => {
            if (value !== 0) {
                // ボードの範囲外（特に上部）に配置しないようにチェック
                if (currentY + r >= 0) {
                    board[currentY + r][currentX + c] = colorIndex;
                }
            }
        });
    });
}

/**
 * そろったラインを消去し、スコアを加算する
 */
function clearLines() {
    let linesCleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
        if (board[r].every(cell => cell !== 0)) { // 行内の全てのセルが0でない (埋まっている)
            linesCleared++;
            board.splice(r, 1); // その行を削除
            board.unshift(Array(COLS).fill(0)); // 新しい空の行を一番上に追加
            r++; // 行がシフトしたので、同じ行インデックスを再チェック
        }
    }
    if (linesCleared > 0) {
        // 消去したライン数に応じてスコアを加算 (例)
        if (linesCleared === 1) score += 100;      // 1ライン
        else if (linesCleared === 2) score += 300; // 2ライン
        else if (linesCleared === 3) score += 500; // 3ライン
        else if (linesCleared >= 4) score += 800; // 4ライン (テトリス)
        updateScore(); // スコア表示を更新
    }
}

/**
 * ゲーム画面全体（ボードと現在のテトリミノ）を描画する
 */
function drawGame() {
    drawBoard(); // ボードを描画
    drawTetrimino(gameCtx, currentTetrimino, currentX, currentY, BLOCK_SIZE); // 現在のテトリミノを描画
}

/**
 * ゲームループのメイン処理 (一定間隔で実行される)
 */
function gameLoop() {
    moveDown(); // テトリミノを1段下に移動
}

/**
 * ゲームを開始する
 */
function startGame() {
    if (gameInterval) {
        clearInterval(gameInterval); // 既存のゲームループがあれば停止
    }
    initBoard(); // ボードを初期化
    score = 0;   // スコアをリセット
    updateScore(); // スコア表示を更新
    nextTetrimino = getRandomTetrimino(); // 最初の「次のテトリミノ」を準備
    spawnTetrimino(); // 最初のテトリミノを出現させる
    drawGame();       // ゲーム画面を描画
    drawNextTetrimino(); // 次のテトリミノ表示を更新
    gameInterval = setInterval(gameLoop, gameSpeed); // 新しいゲームループを開始
    startButton.textContent = "リスタート"; // ボタンのテキストを「リスタート」に変更
}

/**
 * ゲームオーバー処理
 */
function gameOver() {
    clearInterval(gameInterval); // ゲームループを停止
    gameInterval = null;
    // ゲームオーバーメッセージをキャンバスに表示
    gameCtx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    gameCtx.fillRect(0, gameCanvas.height / 2 - 30, gameCanvas.width, 60);
    gameCtx.font = '24px Arial';
    gameCtx.fillStyle = 'white';
    gameCtx.textAlign = 'center';
    gameCtx.fillText('ゲームオーバー!', gameCanvas.width / 2, gameCanvas.height / 2);
    startButton.textContent = "ゲーム開始"; // ボタンのテキストを「ゲーム開始」に戻す
}

// --- イベントリスナー ---
startButton.addEventListener('click', startGame); // スタートボタンのクリックイベント

document.addEventListener('keydown', (event) => {
    if (!gameInterval) return; // ゲームが実行中でなければ何もしない

    switch (event.key) {
        case 'ArrowLeft': // 左矢印キー
        case 'a': // 'a' キー (左移動)
            moveLeft();
            break;
        case 'ArrowRight': // 右矢印キー
        case 'd': // 'd' キー (右移動)
            moveRight();
            break;
        case 'ArrowDown': // 下矢印キー
        case 's': // 's' キー (ソフトドロップ)
            moveDown();
            break;
        case 'ArrowUp': // 上矢印キー
        case 'w': // 'w' キー (回転)
            rotateTetrimino();
            break;
        case ' ': // スペースキー (ハードドロップ)
            hardDrop();
            break;
    }
});

// --- 初期化処理 ---
initBoard(); // ボードの初期化
drawBoard();   // 初期ボードの描画
updateScore(); // 初期スコアの表示 (0点)
drawNextTetrimino(); // 「次のブロック」エリアの初期表示
console.log("テトリスゲームが初期化されました。「ゲーム開始」ボタンを押してください。");
