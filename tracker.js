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
            return this.OK;
        } else if(command.startsWith("!M")) {
            return this.mode(command.slice(2, -1)); // Remove !M and \r
        } else if(command === "!R\r") {
            return this.mode("1,P,B");
        } else if(command === "S") {
            return this.orientation();
        } else {
            console.error("Unrecognized command:", command);
            return this.ERR;
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
            return this.ERR;
        }
        if(send_mode === "P") {
            this.send_mode = "polled";
        } else {
            // TODO?: Continuous
            console.error("Unsupported send mode:", send_mode);
            return this.ERR;
        }
        if(send_format === "B") {
            this.send_format = "binary";
        } else {
            // TODO: ASCII
            console.error("Unsupported send format:", send_format);
            return this.ERR;
        }
        return this.OK;
    }
    
    orientation() {

        let pitch = window.pitch || 0.0; // Radians
        let roll = window.roll || 0.0; // Radians
        
        let absolute_x = Math.cos(window.yaw || 0.0);
        let absolute_y = 0.0;
        let absolute_z = Math.sin(window.yaw || 0.0);
        
        let antirotation = twgl.m4.identity();
        twgl.m4.rotateZ(antirotation, -roll, antirotation);
        twgl.m4.rotateX(antirotation, -pitch, antirotation);
        let [x, y, z] = twgl.m4.transformDirection(antirotation, [absolute_x, absolute_y, absolute_z]);
        
        let result = new ArrayBuffer(12);
        let view = new DataView(result);
        view.setInt8(0, 0xFF);
        view.setInt16(1, x * 16384, false);
        view.setInt16(3, y * 16384, false);
        view.setInt16(5, z * 16384, false);
        view.setInt16(7, pitch/Math.PI*16384, false);
        view.setInt16(9, roll/Math.PI*16384, false);
        let checksum = 0;
        for(let i=0; i<=10; i++) {
            checksum += view.getUint8(i);
        }
        view.setUint8(11, checksum);
        
        return new Uint8Array(result);
    }
    
    install(sockfs) {
        let tracker = this;
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
        sockfs.websocket_sock_ops.recvmsg = function(sock, length) {
            let reply = tracker.reply.slice(0, length);
            let remainder = tracker.reply.slice(length);
            if(remainder.length !== 0) {
                tracker.reply = remainder;
            } else {
                tracker.reply = null;
            }
            return {
                buffer: reply,
                addr: "tracker.invalid",
                port: 8000
            }
        };
        sockfs.websocket_sock_ops.sendmsg = function(sock, buffer, offset, length, addr, port) {
            let incoming = buffer.slice(offset, offset+length);
            let command = tracker.decoder.decode(incoming);
            tracker.reply = tracker.dispatch(command);
            return length;
        };
    }
}

