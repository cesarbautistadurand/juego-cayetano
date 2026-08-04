const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static(__dirname));

let jugadores = {}; 
let alienX = 0;
let alienY = 0;

let estadoJuego = 'esperando'; 
let segundosRestantes = 120;   
let segundosCountdown = 120; // 2 minutos de espera al inicio
let intervaloJuego = null;
let intervaloCountdown = null;

function generarAlien() {
    alienX = Math.floor(Math.random() * 19) - 9; 
    alienY = Math.floor(Math.random() * 13) - 6;
    if(alienX === 0 && alienY === 0) generarAlien();
}

function enviarRanking() {
    let listaOrdenada = Object.values(jugadores).sort((a, b) => b.puntaje - a.puntaje);
    io.emit('actualizarRanking', listaOrdenada);
}

function iniciarCountdown() {
    estadoJuego = 'countdown';
    segundosCountdown = 120;

    for (let id in jugadores) {
        jugadores[id].puntaje = 0;
    }
    enviarRanking();

    io.emit('inicioCountdown', segundosCountdown);

    if (intervaloCountdown) clearInterval(intervaloCountdown);
    intervaloCountdown = setInterval(() => {
        segundosCountdown--;
        io.emit('actualizarCountdown', segundosCountdown);

        if (segundosCountdown <= 0) {
            clearInterval(intervaloCountdown);
            iniciarJuego();
        }
    }, 1000);
}

function iniciarJuego() {
    estadoJuego = 'jugando';
    segundosRestantes = 120; 
    generarAlien();
    
    io.emit('comenzarPartida', { x: alienX, y: alienY });

    if (intervaloJuego) clearInterval(intervaloJuego);
    intervaloJuego = setInterval(() => {
        segundosRestantes--;
        io.emit('actualizarReloj', segundosRestantes);

        if (segundosRestantes <= 0) {
            clearInterval(intervaloJuego);
            finalizarJuego();
        }
    }, 1000);
}

function finalizarJuego() {
    estadoJuego = 'terminado';
    let listaOrdenada = Object.values(jugadores).sort((a, b) => b.puntaje - a.puntaje);
    
    io.emit('finPartida', { ranking: listaOrdenada.slice(0, 10) });

    setTimeout(() => {
        if (Object.keys(jugadores).length > 0) {
            iniciarCountdown();
        } else {
            estadoJuego = 'esperando';
        }
    }, 60000);
}

io.on('connection', (socket) => {
    
    socket.on('registrarJugador', (nombreAlumno) => {
        jugadores[socket.id] = { nombre: nombreAlumno, puntaje: 0 };
        enviarRanking();

        if (estadoJuego === 'esperando') {
            iniciarCountdown();
        } else if (estadoJuego === 'countdown') {
            socket.emit('inicioCountdown', segundosCountdown);
        } else if (estadoJuego === 'jugando') {
            socket.emit('comenzarPartida', { x: alienX, y: alienY });
        } else if (estadoJuego === 'terminado') {
            socket.emit('actualizarRanking', Object.values(jugadores).sort((a, b) => b.puntaje - a.puntaje));
        }
    });

    socket.on('disparo', (intento) => {
        if (!jugadores[socket.id] || estadoJuego !== 'jugando') return;

        if (intento.x === alienX && intento.y === alienY) {
            jugadores[socket.id].puntaje += 100;
            generarAlien();
            
            io.emit('impactoCorrecto', { 
                nombreGanador: jugadores[socket.id].nombre,
                nuevoX: alienX, 
                nuevoY: alienY 
            });
            enviarRanking(); 
        } else {
            socket.emit('fallo', intento);
        }
    });

    socket.on('disconnect', () => {
        if(jugadores[socket.id]) {
            delete jugadores[socket.id];
            enviarRanking();
            if (Object.keys(jugadores).length === 0) {
                if (intervaloCountdown) clearInterval(intervaloCountdown);
                if (intervaloJuego) clearInterval(intervaloJuego);
                estadoJuego = 'esperando';
            }
        }
    });
});

const PUERTO = process.env.PORT || 3000;
http.listen(PUERTO, () => {
    console.log(`¡Servidor activado! Escuchando en el puerto ${PUERTO}`);
});
