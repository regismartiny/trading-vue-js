<template>
    <span class="container">
        <symbol-selector :initial-symbol="selected_symbol" v-on:selected="on_selected_symbol"></symbol-selector>
        <tf-selector :charts="timeFrames" :selectedTimeframeIndex="selected_timeframe_index" v-on:selected="on_selected"></tf-selector>
        <span class="settings-panel">
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
            <span class="grid-mode">
                <input type="checkbox" v-model="show_grid">
                <label>Show Grid</label>
            </span>
         </span>
        <trading-vue :data="chart" :width="this.width" :height="this.height"
                :titleTxt="selected_symbol"
                :toolbar="true"
                :timezone="-3"
                :index-based="index_based"
                :log_scale="log_scale"
                :selected_timeframe="selected_timeframe"
                :selected_symbol="selected_symbol"
                :color-back="colors.colorBack"
                :color-grid="colors.colorGrid"
                :color-text="colors.colorText"
                :overlays="overlays"
                :legend-buttons="buttons"
                v-on:legend-button-click="on_button_click"
                v-on:createpricealert-button-click="on_createpricealert_button_click"
                v-on:tool-changed="on_tool_changed"
                ref="tradingVue">
        </trading-vue>
    </span>
</template>
    
<script>
import TradingVue from './TradingVue.vue'
import Const from './stuff/constants.js'
import Utils from './stuff/utils.js'
import SymbolSelector from './components/SymbolSelector.vue'
import TfSelector from './components/TFSelector.vue'
import Stream from './components/DataHelper/stream.js'
import DataCube from './helpers/datacube.js'
import CodeIcon from './components/LegendButtons/code3.json'
import EMA from './components/overlays/EMA/EMA.vue'
import BB from './components/overlays/BB/BB.vue'

// Gettin' data through webpack proxy
const PORT = location.port
const URL = `http://localhost:${PORT}/api/v1/klines?symbol=`
const WSS = `ws://localhost:${PORT}/ws/api/{symbol}@aggTrade`

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

const initialOnchartOverlays = [
    {
        type: 'EMA',
        name: 'EMA, 20',
        data: [],
        settings: {
            length: 20
        }
    },
    {
        type: 'EMA',
        name: 'EMA, 100',
        data: [],
        settings: {
            length: 100,
            lineWidth: 1.5
        }
    },
    {
        type: 'EMA',
        name: 'EMA, 200',
        data: [],
        settings: {
            length: 200,
            lineWidth: 2.0
        }
    },
    {
        type: 'BB',
        name: 'BB, 21, 2',
        data: [],
        settings: {
            display: false
        }
    }
]

export default {
    name: 'App',
    description: 'Main App',
    components: {
        SymbolSelector, TfSelector, TradingVue
    },
    methods: {
        onResize(event) {
            this.width = window.innerWidth
            this.height = window.innerHeight - 40
        },
        on_selected(tf) {
            this.selected_timeframe = tf.name
            this.reloadData(this.selected_symbol, this.selected_timeframe)
        },
        on_selected_symbol(newSymbol) {
            this.selected_symbol = newSymbol;
            this.reloadData(this.selected_symbol, this.selected_timeframe)
        },
        // New data handler. Should return Promise, or
        // use callback: load_chunk(range, tf, callback)
        async load_chunk(symbol, range, interval) {
            let [t1, t2] = range
            let url = getAPIURL(symbol, interval, t1, t2)
            let r = await fetch(url).then(r => r.json())
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
            if (trade.s != this.selected_symbol) return
            this.chart.update({
                t: trade.T,     // Exchange time (optional)
                price: parseFloat(trade.p),   // Trade price
                volume: parseFloat(trade.q),  // Trade amount
                // 'datasets.binance-btcusdt': [ // Update dataset
                //     trade.T,
                //     trade.m ? 0 : 1,          // Sell or Buy
                //     parseFloat(trade.q),
                //     parseFloat(trade.p)
                // ],
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
                onchart: getOnchartOverlays(),
                // offchart: [{
                //     type: 'BuySellBalance',
                //     name: 'Buy/Sell Balance, $lookback',
                //     data: [],
                //     settings: {}
                // }],
                // datasets: [{
                //     type: 'Trades',
                //     id: 'binance-btcusdt',
                //     data: []
                // }]
            }, { aggregation: 100 })
            // Register onrange callback & And a stream of trades
            this.chart.onrange(range => this.load_chunk(symbol, range, binanceTf))
            this.$refs.tradingVue.resetChart()
            this.stream = new Stream(getWebsocketURL())
            this.stream.ontrades = this.on_trades
            window.dc = this.chart      // Debug
            window.tv = this.$refs.tvjs // Debug
            })
        },
        on_button_click(event) {
            if (event.type == 'onchart') {
                if (event.button === 'display') {
                    let d = this.chart.data[event.type][event.dataIndex]
                    if (d) {
                        if (!('display' in d.settings)) {
                            this.$set(d.settings, 'display', true)
                        }
                        this.$set(d.settings, 'display', !d.settings.display)
                    }
                } else if(event.button === 'settings') {
                    let d = this.chart.data[event.type][event.dataIndex]
                    console.log('settings', d.settings)
                } else if (event.button === 'remove') {
                    this.chart.data[event.type].splice(event.dataIndex, 1)
                }
                localStorage.setItem('tradingVue:onchartOverlays', JSON.stringify(this.chart.data.onchart))
            }
        },
        on_createpricealert_button_click(event) {
            console.log('createpricealert_button_click', event)
        },
        on_tool_changed(event) {
            console.log('tool-changed', event)
            const onChart = this.chart.data.onchart
            const onChartItem = onChart[event.onChartIndex]
            if (onChartItem.settings.$state == 'finished') {
                localStorage.setItem('tradingVue:onchartOverlays', JSON.stringify(onChart))
            }
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
            return this.night ? {
                colorBack: '#000',
                colorGrid: this.grid_color,
            } : 
            {
                colorBack: '#fff',
                colorGrid: this.grid_color,
                colorText: '#333'
            }
        },
        grid_color() {
            return this.show_grid 
            ? (this.night ? '#2f3240' : '#ccc')
            : (this.night ? '#000' : '#eee')
        }
    },
    beforeDestroy() {
        window.removeEventListener('resize', this.onResize)
        if (this.stream) this.stream.off()
    },
    data() {
        return {
            timeFrames: timeFrames,
            chart: {},
            width: window.innerWidth,
            height: window.innerHeight - 40,
            log_scale: localStorage.getItem('tradingVue:log_scale') === 'true',
            index_based: localStorage.getItem('tradingVue:index_based') === 'true',
            night: localStorage.getItem('tradingVue:nm') === 'true',
            show_grid: localStorage.getItem('tradingVue:show_grid') === 'true',
            selected_symbol: getSelectedSymbol(),
            selected_timeframe: localStorage.getItem('tradingVue:selected_timeframe'),
            selected_timeframe_index: getSelectedTimeframeIndex(),
            overlays: [EMA, BB],
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
        show_grid(v) {
            localStorage.setItem('tradingVue:show_grid', v)
            this.colors.colorGrid = this.grid_color
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
function getOnchartOverlays() {
    const persistedOnchartOverlays = JSON.parse(localStorage.getItem('tradingVue:onchartOverlays'))
    persistedOnchartOverlays.forEach(overlay => overlay.settings.$selected = false)
    return persistedOnchartOverlays || initialOnchartOverlays
}
function getAPIURL(symbol, interval, startTime, endTime) {
    return URL + `${symbol}&interval=${interval}&startTime=${startTime}&endTime=${endTime}`
}
function getWebsocketURL() {
    return WSS.replace('{symbol}', getSelectedSymbol().toLowerCase())
}
</script>

<style>
.container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px;
    background-color: rgb(14, 19, 31);
}
.symbol-selector {
    position: absolute;
    top: 5px;
    left: 60px;
    width: 100px;
    color: aliceblue;
}
.tf-selector {
    position: absolute;
    top: 0px;
    left: 280px;
    width: 270px;
    font: 16px -apple-system,BlinkMacSystemFont,
        Segoe UI,Roboto,Oxygen,Ubuntu,Cantarell,
        Fira Sans,Droid Sans,Helvetica Neue,
        sans-serif;
}
.settings-panel {
    position: absolute;
    top: 2px;
    right: 0px;
    width: 250px;
    color: #888;
    font: 11px -apple-system, BlinkMacSystemFont,
        Segoe UI, Roboto, Oxygen, Ubuntu, Cantarell,
        Fira Sans, Droid Sans, Helvetica Neue,
        sans-serif
}
</style>
    