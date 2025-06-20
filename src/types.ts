// Tetrimino 型の定義
export type TetriminoShape = number[][];

export interface Tetrimino {
    shape: TetriminoShape;
    color: string;
}
