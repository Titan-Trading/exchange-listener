let ioInstance = null;
let tcpHandlerInstance = null;

module.exports = {
    start: (tcpHandler, io) => {
        ioInstance = io;

        let traderIO    = io.of('/traders');
        let webClientIO = io.of('/webClients');

        tcpHandlerInstance = tcpHandler;

        // use different namespaces to separate trader and web client connections
        // web socket server for server <-> traders communications
        traderIO.on('connection', (socket) => {
            // when trader node connects
            tcpHandlerInstance.onConnect(socket, 'trader');

            // trader node needs to be identified/authenticated
            socket.on('handshake', (data) => {
                tcpHandlerInstance.onHandshake(socket, 'trader', data);
            });

            // updates from trader nodes
            socket.on('update', (data) => {
                tcpHandlerInstance.onUpdate(socket, 'trader', data);
            });

            // when trader node disconnects
            socket.on('disconnect', () => {
                tcpHandlerInstance.onDisconnect(socket, 'trader');
            });
            
            // when trader has socket error
            socket.on('error', (err) => {
                tcpHandlerInstance.onError(socket, 'trader', err);
            });
        });

        // web socket server for server <-> clients communications
        webClientIO.on('connection', (socket) => {
            // when web client connects
            tcpHandlerInstance.onConnect(socket, 'web_client');
            
            // client needs to be identified/authenticated
            socket.on('handshake', (data) => {
                tcpHandlerInstance.onHandshake(socket, 'web_client', data);
            });
            // updates from web clients
            socket.on('update', (data) => {
                tcpHandlerInstance.onUpdate(socket, 'web_client', data);
            });
            // when web client or trader node disconnects
            socket.on('disconnect', () => {
                tcpHandlerInstance.onDisconnect(socket, 'web_client');
            });
            // when web client has socket error
            socket.on('error', (err) => {
                tcpHandlerInstance.onError(socket, 'web_client', err);
            });
        }); 
    },
    stop: () => {
        console.log('Disconnecting all clients...');
        
        // get all connected trader and clients and disconnect them
        let sockets = tcpHandlerInstance.getSockets();
        for(let iSocket in sockets) {
            let socket = sockets[iSocket].socket;
            socket.disconnect();
        }
        
        console.log('Shutting down socket server...');
        
        // shutdown socket.io server
        ioInstance.close();
    }
};