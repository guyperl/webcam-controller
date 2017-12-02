const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

// Is the current build a development build
const IS_DEV = (process.env.NODE_ENV === 'dev');

const dirNode = 'node_modules';
const dirApp = path.join(__dirname, 'app');
const dirAssets = path.join(__dirname, 'assets');

const appHtmlTitle = 'Webcam Controller';

/**
 * Webpack Configuration
 */
module.exports = {
  devtool: 'source-map',
  entry: {
    vendor: [
      'lodash'
    ],
    bundle: path.join(dirApp, 'index')
  },
  resolve: {
    modules: [
      dirNode,
      dirApp,
      dirAssets
    ]
  },
  plugins: [
    new webpack.DefinePlugin({
      IS_DEV: IS_DEV
    }),

    new webpack.ProvidePlugin({
      // lodash
      '_': 'lodash'
    }),

    new HtmlWebpackPlugin({
      template: path.join(__dirname, 'index.html'),
      title: appHtmlTitle
    })
  ],
  module: {
    loaders: [
      // {
      //   test: require.resolve('js-objectdetect/js/objectdetect'),
      //   loader: 'exports-loader?objectdetect'
      // },
      // {
      //   test: require.resolve('js-objectdetect/js/objectdetect.handfist'),
      //   loader: 'imports-loader?this=>objectdetect'
      // },
      // {
      //   test: require.resolve('js-objectdetect/js/objectdetect.handopen'),
      //   loader: 'imports-loader?this=>objectdetect'
      // }
    ],
    rules: [
      // // BABEL
      // {
      //   test: /\.js$/,
      //   loader: 'babel-loader?retainLines=true',
      //   exclude: /(node_modules)/,
      //   options: {
      //     compact: true
      //   }
      // },

      // STYLES
      {
        test: /\.css$/,
        use: [
          'style-loader',
          {
            loader: 'css-loader',
            options: {
              sourceMap: IS_DEV
            }
          },
        ]
      },

      // CSS / SASS
      {
        test: /\.scss/,
        use: [
          'style-loader',
          {
            loader: 'css-loader',
            options: {
              sourceMap: IS_DEV
            }
          },
          {
            loader: 'sass-loader',
            options: {
              sourceMap: IS_DEV,
              includePaths: [dirAssets]
            }
          }
        ]
      },

      // IMAGES
      {
        test: /\.(jpe?g|png|gif)$/,
        loader: 'file-loader',
        options: {
          name: '[path][name].[ext]'
        }
      }
    ]
  }
};
