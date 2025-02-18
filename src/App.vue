<template>
    <span>
        <trading-vue :data="chart" :width="this.width" :height="this.height"
                :titleTxt="symbol"
                :night="night"
                :toolbar="true"
                :timezone="-3"
                :index-based="index_based"
                :log_scale="log_scale"
                :selected_timeframe="selected_timeframe"
                :selected_symbol="selected_symbol"
                :colors="colors"
                :color-back="colors.colorBack"
                :color-grid="colors.colorGrid"
                :color-text="colors.colorText"
                :overlays="overlays"
                :legend-buttons="buttons"
                v-on:legend-button-click="on_button_click"
                ref="tradingVue">
        </trading-vue>
        <tf-selector :charts="charts" :selectedTimeframeIndex="selected_timeframe_index" v-on:selected="on_selected"></tf-selector>
        <span class="night-mode">
            <input type="checkbox" v-model="night">
            <label>Night Mode</label>
        </span>
        <span class="log-scale">
            <input type="checkbox" v-model="log_scale">
            <label>Log Scale</label>
        </span>
        <span class="gc-mode">
            <input type="checkbox" v-model="index_based">
            <label>Index Based</label>
        </span>
    </span>
</template>
    
<script>
import TradingVue from './TradingVue.vue'
import Const from './stuff/constants.js'
import Utils from './stuff/utils.js'
import TfSelector from './components/Timeframes/TFSelector.vue'
import Stream from './components/DataHelper/stream.js'
import DataCube from './helpers/datacube.js'
import CodeIcon from './components/LegendButtons/code3.json'
import EMAx6 from './components/Scripts/EMAx6.vue'
import BollingerBands from './components/Scripts/BollingerBands.vue'

// Gettin' data through webpack proxy
const PORT = location.port
const URL = `http://localhost:${PORT}/api/v1/klines?symbol=`
const WSS = `ws://localhost:${PORT}/ws/api/btcusdt@aggTrade`

const CHUNK_SIZE = 200

// const binancesTimeframes = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M']
const binanceTimeframesMap = new Map();
binanceTimeframesMap.set('1m', '1m');
binanceTimeframesMap.set('5m', '5m');
binanceTimeframesMap.set('15m', '15m');
binanceTimeframesMap.set('30m', '30m');
binanceTimeframesMap.set('1H', '1h');
binanceTimeframesMap.set('4H', '4h');
binanceTimeframesMap.set('1D', '1d');
binanceTimeframesMap.set('1W', '1w');
binanceTimeframesMap.set('1M', '1M');
const timeFrames = Object.fromEntries(
  [...binanceTimeframesMap.keys()].map(value => [value, []])
);

export default {
    name: 'App',
    description: 'Main App',
    components: {
        TradingVue, TfSelector
    },
    methods: {
        onResize(event) {
            this.width = window.innerWidth
            this.height = window.innerHeight
        },
        on_selected(tf) {
            this.selected_timeframe = tf.name
            this.reloadData(this.selected_symbol, this.selected_timeframe)
        },
        // New data handler. Should return Promise, or
        // use callback: load_chunk(range, tf, callback)
        async load_chunk(symbol, range, interval) {
            let [t1, t2] = range
            let q = `${symbol}&interval=${interval}&startTime=${t1}&endTime=${t2}`
            let r = await fetch(URL + q).then(r => r.json())
            return this.format(this.parse_binance(r))
        },
        // Parse a specific exchange format
        parse_binance(data) {
            if (!Array.isArray(data)) return []
            return data.map(x => {
                for (var i = 0; i < x.length; i++) {
                    x[i] = parseFloat(x[i])
                }
                return x.slice(0,6)
            })
        },
        format(data) {
            // Each query sets data to a corresponding overlay
            return {
                'chart.data': data
                // other onchart/offchart overlays can be added here,
                // but we are using Script Engine to calculate some:
                // see EMAx6 & BuySellBalance
            }
        },
        on_trades(trade) {
            if (!this.chart) return
            this.chart.update({
                t: trade.T,     // Exchange time (optional)
                price: parseFloat(trade.p),   // Trade price
                volume: parseFloat(trade.q),  // Trade amount
                'datasets.binance-btcusdt': [ // Update dataset
                    trade.T,
                    trade.m ? 0 : 1,          // Sell or Buy
                    parseFloat(trade.q),
                    parseFloat(trade.p)
                ],
                // ... other onchart/offchart updates
            })
        },
        reloadData(symbol, interval) {
            if (!this.chart) return
            if (this.stream) this.stream.off()
            let now = Utils.now()
            const sub = Const.map_unit[interval] * CHUNK_SIZE
            const startTime = now - sub
            const binanceTf = binanceTimeframesMap.get(interval)
            this.load_chunk(symbol, [startTime, now], binanceTf).then(data => {
            this.chart = new DataCube({
                ohlcv: data['chart.data'],
                onchart: [
                    {
                        type: 'EMAx6',
                        name: 'Multiple EMA',
                        data: []
                    },
                    // {
                    //     type: 'BollingerBands',
                    //     name: 'Bollinger Bands',
                    //     data: []
                    // }
                ],
                // offchart: [{
                //     type: 'BuySellBalance',
                //     name: 'Buy/Sell Balance, $lookback',
                //     data: [],
                //     settings: {}
                // }],
                datasets: [{
                    type: 'Trades',
                    id: 'binance-btcusdt',
                    data: []
                }]
            }, { aggregation: 100 })
            // Register onrange callback & And a stream of trades
            this.chart.onrange(range => this.load_chunk(symbol, range, binanceTf))
            this.$refs.tradingVue.resetChart()
            this.stream = new Stream(WSS)
            this.stream.ontrades = this.on_trades
            window.dc = this.chart      // Debug
            window.tv = this.$refs.tvjs // Debug
            })
        },
        on_button_click(event) {
            if (event.button === 'display') {
                let d = this.chart.data[event.type][event.dataIndex]
                if (d) {
                    if (!('display' in d.settings)) {
                        this.$set(
                            d.settings, 'display', true
                        )
                    }
                    this.$set(
                        d.settings, 'display', !d.settings.display
                    )
                }
            }
            console.log(event)
        }
    },
    mounted() {
        window.addEventListener('resize', this.onResize)
        this.onResize()
        window.dc = this.chart
        window.tv = this.$refs.tradingVue

        // Load the last data chunk & init DataCube:
        this.reloadData(this.selected_symbol, this.selected_timeframe)
    },
    computed: {
        colors() {
            return this.night ? {} : {
                colorBack: '#fff',
                colorGrid: '#eee',
                colorText: '#333'
            }
        },
    },
    beforeDestroy() {
        window.removeEventListener('resize', this.onResize)
        if (this.stream) this.stream.off()
    },
    data() {
        return {
            charts: timeFrames,
            chart: {},
            symbol: getSelectedSymbol(),
            width: window.innerWidth,
            height: window.innerHeight,
            log_scale: localStorage.getItem('tradingVue:log_scale') === 'true',
            index_based: localStorage.getItem('tradingVue:index_based') === 'true',
            night: localStorage.getItem('tradingVue:nm') === 'true',
            selected_symbol: getSelectedSymbol(),
            selected_timeframe: localStorage.getItem('tradingVue:selected_timeframe'),
            selected_timeframe_index: getSelectedTimeframeIndex(),
            overlays: [EMAx6, BollingerBands],
            buttons: [
                'display', 'settings', 'remove',
                // {
                //     name: 'code',
                //     icon: CodeIcon
                // }
            ]
        };
    },
    watch: {
        log_scale(value) {
            if (this.chart.data.chart) {
                this.$set(this.chart.data.chart, 'grid', {
                    logScale: value
                })
                localStorage.setItem('tradingVue:log_scale', value)
            }
        },
        night(v) {
            localStorage.setItem('tradingVue:nm', v)
        },
        index_based(v) {
            localStorage.setItem('tradingVue:index_based', v)
        },
        selected_timeframe(v) {
            localStorage.setItem('tradingVue:selected_timeframe', v)
        },
        selected_symbol(v) {
            localStorage.setItem('tradingVue:selected_symbol', v)
        }
    }
}

function getSelectedSymbol() {
    return localStorage.getItem('tradingVue:selected_symbol') || 'BTCUSDT'
}

function getSelectedTimeframeIndex() {
    const selectedTimeframe = localStorage.getItem('tradingVue:selected_timeframe') || '1D'
    return Object.keys(timeFrames).indexOf(selectedTimeframe)
}
</script>

<style>
.tf-selector {
    top: 5px;
    left: 500px;
    width: 270px;
    font: 16px -apple-system,BlinkMacSystemFont,
        Segoe UI,Roboto,Oxygen,Ubuntu,Cantarell,
        Fira Sans,Droid Sans,Helvetica Neue,
        sans-serif;
}
.night-mode {
    position: absolute;
    top: 50px;
    left: 700px;
    color: #888;
    font: 11px -apple-system, BlinkMacSystemFont,
        Segoe UI, Roboto, Oxygen, Ubuntu, Cantarell,
        Fira Sans, Droid Sans, Helvetica Neue,
        sans-serif
}
.log-scale {
    position: absolute;
    top: 65px;
    left: 700px;
    color: #888;
    font: 11px -apple-system, BlinkMacSystemFont,
        Segoe UI, Roboto, Oxygen, Ubuntu, Cantarell,
        Fira Sans, Droid Sans, Helvetica Neue,
        sans-serif
}
.gc-mode {
    position: absolute;
    top: 80px;
    left: 700px;
    color: #888;
    font: 11px -apple-system, BlinkMacSystemFont,
        Segoe UI, Roboto, Oxygen, Ubuntu, Cantarell,
        Fira Sans, Droid Sans, Helvetica Neue,
        sans-serif
}
@media only screen and (max-device-width: 480px) {
    .tf-selector {
        top: 50px;
        left: 70px;
        max-width: 300px;
        font: 12px -apple-system,BlinkMacSystemFont,
            Segoe UI,Roboto,Oxygen,Ubuntu,Cantarell,
            Fira Sans,Droid Sans,Helvetica Neue,
            sans-serif;
    }
    .night-mode {
        position: absolute;
        top: 100px;
        right: 240px;
        color: #888;
        font: 11px -apple-system, BlinkMacSystemFont,
            Segoe UI, Roboto, Oxygen, Ubuntu, Cantarell,
            Fira Sans, Droid Sans, Helvetica Neue,
            sans-serif
    }
    .log-scale {
        position: absolute;
        top: 100px;
        right: 160px;
        color: #888;
        font: 11px -apple-system, BlinkMacSystemFont,
            Segoe UI, Roboto, Oxygen, Ubuntu, Cantarell,
            Fira Sans, Droid Sans, Helvetica Neue,
            sans-serif
    }
    .gc-mode {
        position: absolute;
        top: 100px;
        right: 70px;
        color: #888;
        font: 11px -apple-system, BlinkMacSystemFont,
            Segoe UI, Roboto, Oxygen, Ubuntu, Cantarell,
            Fira Sans, Droid Sans, Helvetica Neue,
            sans-serif
    }
}
</style>
    