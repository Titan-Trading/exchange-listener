require('dotenv').config();

const RestAPI = require('./api');

const net = require('net');

let server = net.createServer(function(socket) {
	socket.write('Echo server\r\n');
	// socket.pipe(socket);

    socket.on('data', (data) => {
        console.log(data);
        socket.write(data);
    });
});

server.listen(process.env.SOCKET_SERVER_PORT, process.env.SOCKET_SERVER_HOST);