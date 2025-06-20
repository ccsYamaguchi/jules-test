import { Tetrimino, TetriminoShape } from './types';
import { COLS, ROWS, BLOCK_SIZE, NEXT_BLOCK_SIZE, HOLD_BLOCK_SIZE, COLORS, TETROMINOS, MIN_GAME_SPEED, GAME_SPEED_DECREMENT, SCORE_MULTIPLIER_INCREMENT } from './constants';
import { gameCanvas, nextCanvas, holdCanvas, scoreElement, levelDisplayElement, multiplierDisplayElement, startButton, gameCtx, nextCtx, holdCtx, bgmAudio, playPauseButton, volumeSlider } from './domElements';

// ゲームの状態変数
let board: number[][] = []; // ゲームボード (2次元配列)
let currentTetrimino: Tetrimino | null = null; // 現在操作中のテトリミノ
let currentX: number = 0; // 現在のテトリミノのX座標 (左上の列)
let currentY: number = 0; // 現在のテトリミノのY座標 (左上の行)
let nextTetrimino: Tetrimino | null = null; // 次に出現するテトリミノ
let holdTetrimino: Tetrimino | null = null; // 追加
let score: number = 0; // 現在のスコア
let gameInterval: number | null = null; // ゲームループのインターバルID
let gameSpeed: number = 500; // テトリミノが1段落下する速度 (ミリ秒)
let canHold: boolean = true; // 追加

let currentLevel: number = 1;
let totalLinesCleared: number = 0;
let scoreMultiplier: number = 1;

// --- ゲームロジック関数 ---

/**
 * 一時退避中のテトリミノを専用のキャンバスに描画する
 */
function drawHoldTetrimino(): void {
    if (!holdCtx || !holdCanvas) return;
    holdCtx.clearRect(0, 0, holdCanvas.width, holdCanvas.height); // ホールド表示エリアをクリア
    if (holdTetrimino) {
        // ホールドテトリミノをholdCanvasの中央に配置する
        const shape = holdTetrimino.shape;
        const holdBlockSizeToDraw = HOLD_BLOCK_SIZE;

        let tetriminoPixelWidth = 0;
        if (shape[0]) {
            tetriminoPixelWidth = shape[0].length * holdBlockSizeToDraw;
        }
        const tetriminoPixelHeight = shape.length * holdBlockSizeToDraw;

        const x = (holdCanvas.width - tetriminoPixelWidth) / (2 * holdBlockSizeToDraw);
        const y = (holdCanvas.height - tetriminoPixelHeight) / (2 * holdBlockSizeToDraw);

        drawTetrimino(holdCtx, holdTetrimino, x, y, holdBlockSizeToDraw);
    }
}

/**
 * 現在のテトリミノを一時退避する (ホールド機能)
 */
function holdCurrentTetrimino(): void {
    if (!canHold || !currentTetrimino) return; // ホールド不可または現在のミノがない場合は何もしない

    if (!holdTetrimino) { // ホールドミノがない場合
        holdTetrimino = currentTetrimino;
        spawnTetrimino(); // 新しいミノを生成 (これによりcanHoldはtrueになるが、直後にfalseにする)
    } else { // ホールドミノがある場合
        const tempCurrentTetrimino = currentTetrimino;
        const tempHoldTetrimino = holdTetrimino;

        // 現在のミノを元ホールドミノに設定し、盤面上部中央に配置
        currentTetrimino = tempHoldTetrimino;
        currentX = Math.floor(COLS / 2) - Math.floor(currentTetrimino.shape[0].length / 2);
        currentY = 0;

        // 交換後のミノが衝突するかどうかをチェック
        if (checkCollision(currentX, currentY, currentTetrimino.shape)) {
            // 衝突する場合：交換をキャンセルし、現在のミノを元に戻す
            currentTetrimino = tempCurrentTetrimino;
            // holdTetrimino は変更しない
            // canHold も true のまま (ホールド操作は失敗)
            return; // 操作を中断
        }
        // 衝突しない場合：ホールドミノを元現在のミノに設定
        holdTetrimino = tempCurrentTetrimino;
    }
    canHold = false; // ホールド操作が成功したので、次の spawn まではホールド不可
    drawHoldTetrimino(); // ホールド表示を更新
    drawGame(); // ゲーム画面を更新 (新しい currentTetrimino を描画)
}

/**
 * ゲームボードを初期化する
 */
function initBoard(): void {
    for (let r = 0; r < ROWS; r++) {
        board[r] = [];
        for (let c = 0; c < COLS; c++) {
            board[r][c] = 0;
        }
    }
}

/**
 * ランダムなテトリミノとその色を返す
 * @returns {Tetrimino} テトリミノの形状と色のオブジェクト
 */
function getRandomTetrimino(): Tetrimino {
    const index = Math.floor(Math.random() * TETROMINOS.length);
    const shape = TETROMINOS[index];
    const color = COLORS[index + 1];
    if (color === null) {
        // Fallback color if COLORS[index + 1] is null, though this case should ideally not happen
        // if TETROMINOS and COLORS are correctly aligned and COLORS[0] is the only null.
        console.warn("getRandomTetrimino: Resolved to a null color, defaulting to a fallback.");
        return { shape: shape, color: '#FFFFFF' }; // Default to white or some error color
    }
    return { shape: shape, color: color };
}

/**
 * 指定されたコンテキストに1つのブロックを描画する
 * @param {CanvasRenderingContext2D} ctx - 描画コンテキスト
 * @param {number} x - ブロックのX座標 (列)
 * @param {number} y - ブロックのY座標 (行)
 * @param {string} color - ブロックの色
 * @param {number} blockSize - 1ブロックのサイズ
 */
function drawBlock(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, blockSize: number): void {
    ctx.fillStyle = color;
    ctx.fillRect(x * blockSize, y * blockSize, blockSize, blockSize);
    ctx.strokeStyle = '#333'; // ブロックの境界線
    ctx.strokeRect(x * blockSize, y * blockSize, blockSize, blockSize);
}

/**
 * ゲームボード全体を描画する
 */
function drawBoard(): void {
    if (!gameCtx || !gameCanvas) return;
    gameCtx.clearRect(0, 0, gameCanvas.width, gameCanvas.height); // キャンバスをクリア
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (board[r][c] !== 0) { // 空でないセルのみ描画
                const color = COLORS[board[r][c]];
                if (color) { // colorがnullでないことを確認
                    drawBlock(gameCtx, c, r, color, BLOCK_SIZE);
                }
            }
        }
    }
}

/**
 * 指定されたコンテキストにテトリミノを描画する
 * @param {CanvasRenderingContext2D} ctx - 描画コンテキスト
 * @param {Tetrimino | null} tetrimino - 描画するテトリミノ
 * @param {number} x - テトリミノのX座標 (左上の列)
 * @param {number} y - テトリミノのY座標 (左上の行)
 * @param {number} blockSize - 1ブロックのサイズ
 */
function drawTetrimino(ctx: CanvasRenderingContext2D, tetrimino: Tetrimino | null, x: number, y: number, blockSize: number): void {
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
function drawNextTetrimino(): void {
    if (!nextCtx || !nextCanvas) return;
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
 * スコア、レベル、倍率表示を更新する
 */
function updateDisplay(): void {
    if (!scoreElement || !levelDisplayElement || !multiplierDisplayElement) return;
    scoreElement.textContent = score.toString();
    levelDisplayElement.textContent = currentLevel.toString();
    multiplierDisplayElement.textContent = `${scoreMultiplier}x`;
}

/**
 * 新しいテトリミノを生成し、初期位置に配置する
 * ゲームオーバーのチェックもここで行う
 */
function spawnTetrimino(): void {
    canHold = true; // 新しいミノの出現時にホールド可能にする

    currentTetrimino = nextTetrimino ? nextTetrimino : getRandomTetrimino();
    nextTetrimino = getRandomTetrimino();
    if (!currentTetrimino) { // currentTetriminoがnullの場合のフォールバック
        gameOver();
        return;
    }
    currentX = Math.floor(COLS / 2) - Math.floor(currentTetrimino.shape[0].length / 2);
    currentY = 0;

    drawNextTetrimino();

    if (checkCollision(currentX, currentY, currentTetrimino.shape)) {
        gameOver();
    }
}

/**
 * テトリミノを1段下に移動させる
 * 衝突する場合はテトリミノを固定し、新しいテトリミノを生成する
 */
function moveDown(): void {
    if (!currentTetrimino) return; // currentTetrimino が null の場合は何もしない
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
function moveLeft(): void {
    if (!currentTetrimino) return;
    if (!checkCollision(currentX - 1, currentY, currentTetrimino.shape)) {
        currentX--; // 衝突しなければ1列左へ
    }
    drawGame(); // ゲーム画面を再描画
}

/**
 * テトリミノを右に1列移動させる
 */
function moveRight(): void {
    if (!currentTetrimino) return;
    if (!checkCollision(currentX + 1, currentY, currentTetrimino.shape)) {
        currentX++; // 衝突しなければ1列右へ
    }
    drawGame(); // ゲーム画面を再描画
}

/**
 * テトリミノを時計回りに90度回転させる
 */
function rotateTetrimino(): void {
    if (!currentTetrimino) return;
    const originalShape = currentTetrimino.shape;
    const N = originalShape.length; // 元の形状の行数
    const M = originalShape[0].length; // 元の形状の列数
    let newShape: TetriminoShape = [];

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
function hardDrop(): void {
    if (!currentTetrimino) return;
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
 * @param {TetriminoShape} shape - チェックするテトリミノの形状
 * @returns {boolean} 衝突する場合はtrue、しない場合はfalse
 */
function checkCollision(x: number, y: number, shape: TetriminoShape): boolean {
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
function placeTetrimino(): void {
    if (!currentTetrimino) return;
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
function clearLines(): void {
    let linesClearedThisTurn = 0; // このターンで消去したライン数
    for (let r = ROWS - 1; r >= 0; r--) {
        if (board[r].every(cell => cell !== 0)) {
            linesClearedThisTurn++;
            board.splice(r, 1);
            board.unshift(Array(COLS).fill(0));
            r++;
        }
    }
    if (linesClearedThisTurn > 0) {
        // 消去したライン数を総ライン数に加算
        totalLinesCleared += linesClearedThisTurn;

        // スコア計算に倍率を適用
        if (linesClearedThisTurn === 1) score += 100 * scoreMultiplier;
        else if (linesClearedThisTurn === 2) score += 300 * scoreMultiplier;
        else if (linesClearedThisTurn === 3) score += 500 * scoreMultiplier;
        else if (linesClearedThisTurn >= 4) score += 800 * scoreMultiplier;

            updateDisplay(); // 表示更新

        // 10ラインごとのレベルアップ処理呼び出し (levelUp() は後で定義)
        // if (Math.floor(totalLinesCleared / 10) > currentLevel -1 ) {
        //     levelUp();
        // }
        // 代わりに、レベルアップの条件を満たしたかどうかのチェックだけ行い、
        // 次のステップで levelUp 関数を実装した際にコメントを解除します。
        if (totalLinesCleared >= currentLevel * 10) {
            levelUp();
        }
    }
}

/**
 * レベルアップ処理
 */
function levelUp(): void {
    currentLevel++;
    scoreMultiplier += SCORE_MULTIPLIER_INCREMENT;

    // ゲーム速度を上げる（gameSpeed を減らす）
    if (gameSpeed > MIN_GAME_SPEED) {
        gameSpeed -= GAME_SPEED_DECREMENT;
        if (gameSpeed < MIN_GAME_SPEED) {
            gameSpeed = MIN_GAME_SPEED;
        }
    }

    // ゲームループを新しい速度で再開
    if (gameInterval) { // gameInterval が null でないことを確認
        clearInterval(gameInterval);
        gameInterval = setInterval(gameLoop, gameSpeed);
    }

    updateDisplay(); // レベルアップ後にも表示を更新

    console.log(`レベルアップ！ 現在のレベル: ${currentLevel}, 倍率: ${scoreMultiplier}, 速度: ${gameSpeed}`); // 動作確認用ログ
}

/**
 * ゲーム画面全体（ボードと現在のテトリミノ）を描画する
 */
function drawGame(): void {
    drawBoard(); // ボードを描画
    if (gameCtx) {
        drawTetrimino(gameCtx, currentTetrimino, currentX, currentY, BLOCK_SIZE); // 現在のテトリミノを描画
    }
}

/**
 * ゲームループのメイン処理 (一定間隔で実行される)
 */
function gameLoop(): void {
    moveDown(); // テトリミノを1段下に移動
}

/**
 * ゲームを開始する
 */
function startGame(): void {
    if (gameInterval) {
        clearInterval(gameInterval);
    }
    initBoard();
    score = 0;
    // updateScore(); // 旧関数呼び出しを削除またはコメントアウト

    // 追加：レベル関連変数の初期化
    currentLevel = 1;
    totalLinesCleared = 0;
    scoreMultiplier = 1;
    // gameSpeed も初期値に戻す（レベルアップで変更されるため）
    gameSpeed = 500; // 初期速度

    updateDisplay(); // 新しい表示更新関数を呼び出し

    holdTetrimino = null;
    canHold = true;
    drawHoldTetrimino();

    nextTetrimino = getRandomTetrimino();
    spawnTetrimino();
    drawGame();
    drawNextTetrimino();

    gameInterval = setInterval(gameLoop, gameSpeed);
    if (startButton) {
        startButton.textContent = "リスタート";
    }
}

/**
 * ゲームオーバー処理
 */
function gameOver(): void {
    if (gameInterval) {
        clearInterval(gameInterval);
    }
    gameInterval = null;
    if (startButton) {
        startButton.textContent = "ゲーム開始"; // ボタンのテキストを「ゲーム開始」に戻す
    }
    if (!gameCtx || !gameCanvas) return;

    // スコアに応じたゲームオーバー演出
    let message = "ゲームオーバー!";
    let detailMessage = `スコア: ${score}`;
    // let animationDuration = 2000; // アニメーションの表示時間 (ミリ秒) - 未使用変数のためコメントアウト

    // 元のキャンバスの状態を保存
    const originalFillStyle = gameCtx.fillStyle;
    const originalFont = gameCtx.font;
    const originalTextAlign = gameCtx.textAlign;

    gameCtx.textAlign = 'center';

    if (score >= 10000) {
        message = "素晴らしい！ハイスコア！";
        detailMessage = `驚異のスコア: ${score}点！`;
        gameCtx.fillStyle = 'rgba(255, 215, 0, 0.75)'; // ゴールドっぽい背景
        gameCtx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);
        gameCtx.font = '30px "MS Gothic", sans-serif';
        gameCtx.fillStyle = 'darkred';
    } else if (score >= 5000) {
        message = "おめでとう！高得点！";
        detailMessage = `あなたのスコア: ${score}点`;
        gameCtx.fillStyle = 'rgba(192, 192, 192, 0.75)'; // シルバーっぽい背景
        gameCtx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);
        gameCtx.font = '28px "MS Gothic", sans-serif';
        gameCtx.fillStyle = 'navy';
    } else {
        // 通常のゲームオーバー
        gameCtx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        gameCtx.fillRect(0, gameCanvas.height / 2 - 40, gameCanvas.width, 80); // メッセージ表示領域
        gameCtx.font = '24px Arial';
        gameCtx.fillStyle = 'white';
    }

    // メインメッセージと詳細メッセージを表示
    gameCtx.fillText(message, gameCanvas.width / 2, gameCanvas.height / 2 - 10);
    if (score < 5000) { // 通常時はスコアを少し下に表示
      gameCtx.font = '20px Arial'; // スコア表示は少し小さく
      gameCtx.fillText(detailMessage, gameCanvas.width / 2, gameCanvas.height / 2 + 20);
    } else { // 高得点時はメッセージのスタイルを継続
      gameCtx.fillText(detailMessage, gameCanvas.width / 2, gameCanvas.height / 2 + 30);
    }


    // 一定時間後にデフォルトのスタイルに戻し、画面をクリアして再描画を促す
    // (ただし、ゲームはリスタートされるまで操作不能)
    // 高得点時の背景は残したままにするため、ここではクリアしない。
    // リスタート時にinitBoard()とdrawBoard()でクリアされる。

    // 元のスタイルに戻す (次に何か描画する時のため)
    gameCtx.fillStyle = originalFillStyle;
    gameCtx.font = originalFont;
    gameCtx.textAlign = originalTextAlign;

    console.log(`ゲームオーバー。スコア: ${score}`); // ログ表示
}

// --- イベントリスナー ---
if (startButton) {
    startButton.addEventListener('click', startGame); // スタートボタンのクリックイベント
}

document.addEventListener('keydown', (event: KeyboardEvent) => {
    if (!gameInterval && event.key !== 'Enter' && event.key !== ' ') {
        if (startButton && startButton.textContent === "ゲーム開始" && (event.key === 'Enter' || event.key === ' ')) {
            startGame();
        }
        return;
    }
    if (!currentTetrimino && gameInterval) return;


    switch (event.key) {
        case 'ArrowLeft':
        case 'a':
            moveLeft();
            event.preventDefault();
            break;
        case 'ArrowRight':
        case 'd':
            moveRight();
            event.preventDefault();
            break;
        case 'ArrowDown':
        case 's':
            moveDown();
            event.preventDefault();
            break;
        case 'ArrowUp':
        case 'w':
            rotateTetrimino();
            event.preventDefault();
            break;
        case ' ': // Space key
            if (gameInterval) {
                hardDrop();
                event.preventDefault();
            }
            break;
        case 'c':
        case 'Shift': // Shift key
            if (gameInterval) {
                holdCurrentTetrimino();
                event.preventDefault();
            }
            break;
    }
});

// --- 初期化処理 ---
initBoard();
// drawBoard(); // startGame 内で呼ばれるので不要な場合がある
// updateScore(); // 旧関数
updateDisplay(); // 初期表示のため
drawNextTetrimino();
drawHoldTetrimino(); // 追加
console.log("テトリスゲームが初期化されました。「ゲーム開始」ボタンを押してください。");

// --- BGMコントロール ---

// 再生/一時停止ボタンのイベントリスナー
if (playPauseButton && bgmAudio) {
    playPauseButton.addEventListener('click', () => {
        if (bgmAudio.paused) {
            bgmAudio.play();
        } else {
            bgmAudio.pause();
        }
    });
}

// 音声再生イベントでボタンテキストを更新
if (bgmAudio && playPauseButton) {
    bgmAudio.addEventListener('play', () => {
        playPauseButton.textContent = '一時停止';
    });
}

// 音声一時停止イベントでボタンテキストを更新
if (bgmAudio && playPauseButton) {
    bgmAudio.addEventListener('pause', () => {
        playPauseButton.textContent = '再生';
    });
}

// 音量スライダーのイベントリスナー
if (volumeSlider && bgmAudio) {
    volumeSlider.addEventListener('input', () => {
        if (bgmAudio && volumeSlider) { // Add null checks for bgmAudio and volumeSlider
            bgmAudio.volume = parseFloat(volumeSlider.value);
            if (bgmAudio.muted && bgmAudio.volume > 0) {
                bgmAudio.muted = false; // 音量操作時にミュート解除
            } else if (!bgmAudio.muted && bgmAudio.volume == 0) {
                // bgmAudio.muted = true; // ユーザーが意図的に0にした場合はミュートする（任意）
            }
        }
    });
}

// ページ読み込み完了後にBGM再生を開始 (autoplayとmutedにより最初は無音)
window.addEventListener('load', () => {
    // ユーザーインタラクション前にplay()を呼び出すとエラーになることがあるため、
    // autoplay属性に任せるか、ユーザーが何かしらの操作をした後に再生を開始するのが一般的。
    // ここではautoplayを信頼し、明示的なplay()呼び出しはコメントアウトしておく。
    // if (bgmAudio) bgmAudio.play().catch(error => console.log("Autoplay was prevented:", error));


    // 初期音量をスライダーに反映（muted属性がついている場合も考慮）
    if (bgmAudio && volumeSlider) {
        if (bgmAudio.muted) {
            // mutedの場合、実際の音量は0ではないかもしれないので、スライダーの初期値(0.5)を維持
            // もしミュート解除時にこの音量を使いたいなら、別途保存しておくなどの処理が必要
        } else {
            volumeSlider.value = bgmAudio.volume.toString();
        }
    }

    // 初期状態でボタンのテキストを正しく設定
    if (bgmAudio && playPauseButton) {
        if (bgmAudio.paused) {
            playPauseButton.textContent = '再生';
        } else {
            playPauseButton.textContent = '一時停止';
        }
    }
});
