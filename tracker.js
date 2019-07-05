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
        sockfs.websocket_sock_ops = new Proxy(sockfs.websocket_sock_ops, {
            get(target, prop) {
                return function(...args) {
                    console.log(prop, "(", args, ")");
                    let result = target[prop].apply(this, args);
                    console.log(prop, " = ", result);
                    return result;
                }
            }
        });
    }
}

