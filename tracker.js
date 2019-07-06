class Tracker {
    constructor() {
    }
    
    install(sockfs) {
        console.log(sockfs);
        let createPeer = sockfs.websocket_sock_ops.createPeer;
        let connect = sockfs.websocket_sock_ops.connect;
        sockfs.websocket_sock_ops.createPeer = function(...args) {
            console.log("createPeer(", args, ")");
            let result = createPeer.apply(this, args);
            console.log(result);
            return result;
        };
        sockfs.websocket_sock_ops.connect = function(...args) {
            //let result = connect.apply(this, args);
            //console.log(result);
            //return result;
            throw new FS.ErrnoError(ERRNO_CODES.EINPROGRESS);
        };
        sockfs.websocket_sock_ops.poll = function() {
            // POLLIN = 0x01
            // POLLOUT = 0x04
            return 0x04
        };
        sockfs.websocket_sock_ops.recvmsg = function() {
            return {
                buffer: new Uint8Array(1),
                addr: "tracker.invalid",
                port: 8000
            }
        };
        sockfs.websocket_sock_ops.sendmsg = function(sock, buffer, offset, length, addr, port) {
            console.log(buffer.slice(offset, offset+length));
            return 0;
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

