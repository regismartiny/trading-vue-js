<script>

import Overlay from '../../mixins/overlay.js'

export default {
    name: 'BollingerBands',
    mixins: [Overlay],
    methods: {
        meta_info() {
            return { author: 'RM', version: '1.0.0' }
        },
        use_for() { return ['BollingerBands'] },
        calc() {
            return {
                props: {
                    period: {
                        def: 20,
                        text: 'Period'
                    },
                    stdDeviation: {
                        def: 2,
                        text: 'Standard Deviation'
                    }
                },
                conf: {
                    'renderer': 'Splines',
                    'plugin1.setting1': 1000 // WIP
                },
                init: `
                    console.log('init script')
                `,
                update: `
                    let [mid, hi, lo] = bb(close, period, stdDeviation)
                    onchart([hi, mid, lo], 'Bollinger Bands', {type:'BollingerBands'})
                `
            }
        }
    }
}
</script>
