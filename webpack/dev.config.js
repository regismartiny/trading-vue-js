const { VueLoaderPlugin } = require('vue-loader');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const WWPlugin = require('./ww_plugin.js');
const TerserPlugin = require('terser-webpack-plugin');
const webpack = require('webpack');

global.port = '8080';

module.exports = (env, options) => ({
    entry: './src/main.js',
    module: {
        rules: [
            {
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
                use: ['vue-style-loader', 'css-loader'] // Consolidated CSS loader rule
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
            template: './src/index.html'
        }),
        new WWPlugin(),
        new webpack.DefinePlugin({
            MOB_DEBUG: JSON.stringify(process.env.MOB_DEBUG)
        })
    ],
    devServer: {
        hot: true,
        open: false, // Do not automatically open browser on start
        port: 8080,
        host: '0.0.0.0',
        proxy: [
            {
                context: ['/api/v1/**'],
                target: 'https://api.binance.com',
                changeOrigin: true
            },
            {
                context: ['/ws/api/**'],
                target: 'wss://stream.binance.com:9443',
                changeOrigin: true,
                ws: true, // Enable WebSocket proxy
                secure: false, // Ensure WebSocket uses SSL/TLS
                logLevel: 'warn', // Reduce logging level to minimize verbosity
                timeout: 120000, // Increase WebSocket timeout to 120 seconds
                maxRetries: 10, // Retry WebSocket connection up to 10 times
                onError: (err) => {
                    console.error('WebSocket connection error:', err);
                },
                onReconnect: () => {
                    console.log('Reconnecting WebSocket...');
                }
            },
            {
                context: ['/api/udf/**'],
                target: 'https://www.bitmex.com',
                changeOrigin: true
            }
        ],
        onListening: function (server) {
            const address = server.listeningApp ? server.listeningApp.address() : null;
            if (address) {
                global.port = address.port;
            } else {
                console.warn("Server address is not available yet.");
            }
        },
        setupMiddlewares: (middlewares, devServer) => {
            // Only enable /debug route if explicitly needed for debugging
            devServer.app.get("/debug", (req, res) => {
                try {
                    const argv = JSON.parse(req.query.argv);
                    console.log(...argv);
                } catch (e) {
                    console.error("Error parsing debug arguments:", e);
                }
                res.send("[OK]");
            });
            return middlewares;
        }
    },
    optimization: {
        minimize: options.mode === 'production',
        minimizer: [
            new TerserPlugin({
                terserOptions: {
                    mangle: {
                        reserved: ['_id', '_tf'] // Keep specific names intact during minification
                    }
                }
            })
        ]
    },
    devtool: 'source-map' // Retain source maps for easier debugging
});
