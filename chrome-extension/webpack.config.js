const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    'sidepanel/app': './sidepanel/app.js',
    'lib/excel-parser': './lib/excel-parser.js',
    'lib/pdf-parser': './lib/pdf-parser.js',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].bundle.js',
  },
  resolve: {
    fallback: {
      fs: false,
      path: false,
      crypto: false,
      stream: false,
      buffer: false,
    },
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'manifest.json', to: '.' },
        { from: 'background.js', to: '.' },
        { from: 'sidepanel/index.html', to: 'sidepanel/' },
        { from: 'sidepanel/styles.css', to: 'sidepanel/' },
        { from: 'lib/ecount-api.js', to: 'lib/' },
        { from: 'lib/storage.js', to: 'lib/' },
        { from: 'lib/ai-ocr.js', to: 'lib/' },
        { from: 'lib/document-generator.js', to: 'lib/' },
        { from: 'lib/email-composer.js', to: 'lib/' },
        { from: 'content-scripts/', to: 'content-scripts/' },
        { from: 'icons/', to: 'icons/' },
      ],
    }),
  ],
};
