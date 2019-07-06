class Tracker {
    constructor() {
        this.encoder = new TextEncoder();
        this.decoder = new TextDecoder();
        this.OK = this.encoder.encode("O");
        this.ERR = this.encoder.encode("E");
        this.reply = null;
        
        this.data_mode = "cooked";
        this.send_mode = "polled";
        this.send_format = "binary";
    }
    
    dispatch(command) {
        if(command === "!\r") {
            console.log("Pinged!");
            this.reply = this.OK;
        } else if(command.startsWith("!M")) {
            this.mode(command.slice(2, -1)); // Remove !M and \r
        } else if(command === "!R\r") {
            this.mode("1,P,B");
        }
    }
    
    mode(modestring) {
        let [data_mode, send_mode, send_format] = modestring.split(",");
        if(data_mode === "1") {
            this.data_mode = "cooked";
        } else if(data_mode === "2") {
            this.data_mode = "euler";
        } else {
            console.error("Unsupported data mode:", data_mode);
            this.reply = this.ERR;
            return;
        }
        if(send_mode === "P") {
            this.send_mode = "polled";
        } else {
            console.error("Unsupported send mode:", send_mode);
            this.reply = this.ERR;
            return;
        }
        this.reply = this.OK;
    }
    
    install(sockfs) {
        let tracker = this;
        console.log(sockfs);
        sockfs.websocket_sock_ops.connect = function(...args) {

            throw new FS.ErrnoError(ERRNO_CODES.EINPROGRESS);
        };
        sockfs.websocket_sock_ops.poll = function() {
            // POLLIN = 0x01
            // POLLOUT = 0x04
            if(tracker.reply) {
                return 0x05;
            } else {
                return 0x04;
            }
        };
        sockfs.websocket_sock_ops.recvmsg = function() {
            let reply = tracker.reply;
            tracker.reply = null;
            return {
                buffer: reply,
                addr: "tracker.invalid",
                port: 8000
            }
        };
        sockfs.websocket_sock_ops.sendmsg = function(sock, buffer, offset, length, addr, port) {
            let incoming = buffer.slice(offset, offset+length);
            let command = tracker.decoder.decode(incoming);
            console.log(command);
            tracker.dispatch(command);
            return length;
        };
        sockfs.websocket_sock_ops = new Proxy(sockfs.websocket_sock_ops, {
            get(target, prop) {
                return function(...args) {
                    if(prop !== "poll") console.log(prop, "(", args, ")");
                    let result = target[prop].apply(this, args);
                    if(prop !== "poll") console.log(prop, " = ", result);
                    return result;
                }
            }
        });
    }
}

