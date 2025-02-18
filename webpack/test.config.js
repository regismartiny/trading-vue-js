const VueLoaderPlugin = require('vue-loader/lib/plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const WWPlugin = require('./ww_plugin.js')
const webpack = require('webpack')

global.port = '8080'

module.exports = {
    entry: './test/index.js',
    module: {
        rules: [{
                test: /\.vue$/,
                exclude: /node_modules/,
                loader: 'vue-loader'
            },
            {
                test: /\.js$/,
                exclude: /node_modules/,
                loader: 'babel-loader'
            },
            {
                test: /\.css$/,
                use: [
                    'vue-style-loader',
                    'css-loader'
                ]
            },
            {
                test: /script_ww\.js$/,
                loader: 'worker-loader'
            }
        ]
    },
    plugins: [
        new VueLoaderPlugin(),
        new HtmlWebpackPlugin({
            template: './test/index.html'
        }),
        new WWPlugin(),
        new webpack.DefinePlugin({
            MOB_DEBUG: JSON.stringify(process.env.MOB_DEBUG)
        })
    ],
    devServer: {
      host: '0.0.0.0',
      proxy: [
          {
              context: ['/api/v1/**'],
              target: 'https://api.binance.com',
              changeOrigin: true,
          },
          {
              context: ['/ws/api/**'],
              target: 'wss://stream.binance.com:9443',
              changeOrigin: true,
              ws: true,
          },
          {
              context: ['/api/udf/**'],
              target: 'https://www.bitmex.com',
              changeOrigin: true,
          },
      ],
      onListening: function (server) {
        // Use server.options.port to get the port instead of accessing 'listeningApp'
        const port = server.options.port
        global.port = port
      },
      setupMiddlewares: function (middlewares, devServer) {
          // Replace the `before` middleware
          devServer.app.get("/debug", function (req, res) {
              try {
                  let argv = JSON.parse(req.query.argv)
                  console.log(...argv)
              } catch (e) {}
              res.send("[OK]")
          })
  
          return middlewares
      }
    },  
    devtool: 'source-map'
}
