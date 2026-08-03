const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static(__dirname));

let jugadores = {}; 
let alienX = 0;
let alienY = 0;

function generarAlien() {
    alienX = Math.floor(Math.random() * 19) - 9; 
    alienY = Math.floor(Math.random() * 13) - 6;
    if(alienX === 0 && alienY === 0) generarAlien();
}

function enviarRanking() {
    let listaOrdenada = Object.values(jugadores).sort((a, b) => b.puntaje - a.puntaje);
    io.emit('actualizarRanking', listaOrdenada);
}

generarAlien();

io.on('connection', (socket) => {
    
    socket.on('registrarJugador', (nombreAlumno) => {
        jugadores[socket.id] = { nombre: nombreAlumno, puntaje: 0 };
        socket.emit('nuevoAlien', { x: alienX, y: alienY });
        enviarRanking();
    });

    socket.on('disparo', (intento) => {
        if (!jugadores[socket.id]) return;

        // EL SERVIDOR AHORA ES CHISMOSO
        console.log(`\n--- NUEVO DISPARO ---`);
        console.log(`🎯 ${jugadores[socket.id].nombre} disparó a -> X: ${intento.x}, Y: ${intento.y}`);
        console.log(`🛸 La nave realmente estaba en -> X: ${alienX}, Y: ${alienY}`);

        if (intento.x === alienX && intento.y === alienY) {
            console.log(`✅ ¡RESULTADO: ACERTÓ!`);
            jugadores[socket.id].puntaje += 100;
            generarAlien();
            
            io.emit('impactoCorrecto', { 
                nombreGanador: jugadores[socket.id].nombre,
                nuevoX: alienX, 
                nuevoY: alienY 
            });
            enviarRanking(); 
        } else {
            console.log(`❌ ¡RESULTADO: FALLÓ!`);
            socket.emit('fallo', intento);
        }
    });

    socket.on('disconnect', () => {
        if(jugadores[socket.id]) {
            delete jugadores[socket.id];
            enviarRanking();
        }
    });
});

const PUERTO = 3000;
http.listen(PUERTO, () => {
    console.log(`¡Servidor activado! Escuchando en el puerto ${PUERTO}`);
});