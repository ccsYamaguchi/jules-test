const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'development', // 'production' にすると最適化される
  entry: './src/game.ts', // エントリーポイント
  output: {
    filename: 'bundle.js', // 出力ファイル名
    path: path.resolve(__dirname, 'dist'), // 出力ディレクトリ
    clean: true, // ビルド前にdistフォルダをクリーンアップ
  },
  module: {
    rules: [
      {
        test: /\.ts$/, // .tsファイルに適用
        use: 'ts-loader', // ts-loaderでTypeScriptをコンパイル
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'], // import時に拡張子を省略可能にする
  },
  devtool: 'inline-source-map', // デバッグ用にソースマップを有効化
  devServer: {
    static: {
      directory: path.join(__dirname, 'dist'), // 開発サーバーのコンテンツベース
    },
    compress: true,
    port: 9000,
    open: true, // サーバー起動時にブラウザを開く
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './dist/index.html', // ビルド時に使用するHTMLテンプレート（既にdistに移動済み）
      filename: 'index.html',       // 出力するHTMLファイル名
      inject: 'body',               // scriptタグをbodyの最後に挿入
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'assets', // コピー元のassetsディレクトリ（プロジェクトルート直下を想定）
          to: 'assets',   // コピー先のdist/assetsディレクトリ
          globOptions: {
            ignore: ['**/.gitkeep'], // .gitkeepファイルはコピーしない
          },
          noErrorOnMissing: true, // コピー元が存在しなくてもエラーにしない（あればコピーする）
        },
        {
          from: 'style.css', // ルートのstyle.cssをコピー (dist/style.cssが正として扱われるなら不要)
          to: 'style.css',   // dist/style.css にコピー
          noErrorOnMissing: true,
        }
      ],
    }),
  ],
};
