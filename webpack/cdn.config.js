const VueLoaderPlugin = require('vue-loader/lib/plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const TerserPlugin = require('terser-webpack-plugin')
const WWPlugin = require('./ww_plugin.js')
const fs = require('fs')

global.port = '8080'

module.exports = [{
    entry: {
        'trading-vue': './src/index.js',
    },
    output: {
        filename: '[name].js',
        library: 'TradingVueJs',
        libraryTarget: 'umd'
    },
    module: {
        rules: [{
                test: /\.vue$/i,
                exclude: /node_modules/,
                loader: 'vue-loader'
            },
            {
                test: /\.js$/i,
                exclude: /node_modules/,
                loader: 'babel-loader'
            },
            {
                test: /\.css$/i,
                use: [
                    'vue-style-loader',
                    'css-loader'
                ]
            },
            {
                test: /script_ww\.js$/i,
                loader: 'worker-loader'
            }
        ]
    },
    plugins: [
        new VueLoaderPlugin(),
        new HtmlWebpackPlugin({
            templateContent: () => `
                <html>
                  <body>
                    <h1>Lib CDN:
                        <a href="http://localhost:${port}/trading-vue.js">
                            http://localhost:${port}/trading-vue.js
                        </a>
                    </h1>
                    <h3>Get build hash:
                    <a href="http://localhost:${port}/status.js">
                        http://localhost:${port}/status.js
                    </a>
                    </h3>
                  </body>
                </html>
              `
        }),
        new WWPlugin(),
        {
            apply(compiler) {
                compiler.hooks.done.tap(this.constructor.name, stats => {
                    console.log(stats.hash)
                    setTimeout(() => fs.writeFileSync(
                        './webpack/cdn_status.js',
                        `console.log('HASH: ${stats.hash}')`
                    ))
                })
            }
        }
    ],
    devServer: {
        onListening: function(server) {
            const address = server.listeningApp && server.listeningApp.address();
            if (address) {
                global.port = address.port;
            } else {
                console.error('Error: Unable to get the address of the server');
            }
        }
    }
}, {
    entry: {
        'status': './webpack/cdn_status.js',
    },
    output: {
        filename: '[name].js',
    },
    module: {
        rules: [
            {
                test: /\.js/i,
                use: 'raw-loader',
            },
        ]
    },
    optimization: {
        runtimeChunk: true,
        minimize: true,
        minimizer: [
            new TerserPlugin({
                include: /\.js$/,
                // Removed sourceMap: false as it is not valid
            })
        ]
    },
    devtool: 'source-map' // Webpack handles source map generation here
}]
