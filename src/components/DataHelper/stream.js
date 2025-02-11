export default function Stream(url) {

    var ws = new WebSocket(url)
    var cb = () => {}


    ws.onopen = function() {
        console.log('Websocket is opened')
    }

    ws.onmessage = function(data) {
        try {
            data = JSON.parse(data.data)
            cb(data)
        } catch(e) {
            console.log(e)
        }
    }

    ws.onclose = function() {
        console.log('Websocket is closed')
    }

    return {
        set ontrades(val) { cb = val },
        off() { ws.close(1000) }
    }
}
