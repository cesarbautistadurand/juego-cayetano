const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static(__dirname));

let jugadores = {}; 
let alienX = 0;
let alienY = 0;

// Control de estados del juego
let estadoJuego = 'esperando'; // 'esperando', 'countdown', 'jugando', 'terminado'
let segundosRestantes = 120;   // 2 minutos de partida
let segundosCountdown = 10;    // 10 segundos de espera inicial
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

// Inicia la cuenta regresiva de 10 segundos
function iniciarCountdown() {
    estadoJuego = 'countdown';
    segundosCountdown = 10;

    // Reseteamos los puntajes al iniciar una nueva ronda
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

// Comienza los 2 minutos de juego
function iniciarJuego() {
    estadoJuego = 'jugando';
    segundosRestantes = 120; // 2 minutos
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

// Termina la ronda y define al ganador
function finalizarJuego() {
    estadoJuego = 'terminado';
    let listaOrdenada = Object.values(jugadores).sort((a, b) => b.puntaje - a.puntaje);
    let ganador = listaOrdenada.length > 0 ? listaOrdenada[0] : { nombre: 'Nadie', puntaje: 0 };

    io.emit('finPartida', { ganador: ganador.nombre, puntaje: ganador.puntaje });

    // Esperamos 6 segundos mostrando al ganador y volvemos a iniciar la cuenta regresiva automáticamente
    setTimeout(() => {
        if (Object.keys(jugadores).length > 0) {
            iniciarCountdown();
        } else {
            estadoJuego = 'esperando';
        }
    }, 6000);
}

io.on('connection', (socket) => {
    
    socket.on('registrarJugador', (nombreAlumno) => {
        jugadores[socket.id] = { nombre: nombreAlumno, puntaje: 0 };
        enviarRanking();

        // Si es el primer jugador en entrar, iniciamos la cuenta regresiva
        if (Object.keys(jugadores).length === 1 && estadoJuego === 'esperando') {
            iniciarCountdown();
        } else if (estadoJuego === 'countdown') {
            socket.emit('actualizarCountdown', segundosCountdown);
        } else if (estadoJuego === 'jugando') {
            socket.emit('comenzarPartida', { x: alienX, y: alienY });
        } else if (estadoJuego === 'terminado') {
            socket.emit('actualizarRanking', Object.values(jugadores).sort((a, b) => b.puntaje - a.puntaje));
        }
    });

    socket.on('disparo', (intento) => {
        // Solo se puede disparar si la partida está en curso
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
            // Si ya no quedan jugadores, detenemos los relojes
            if (Object.keys(jugadores).length === 0) {
                if (intervaloCountdown) clearInterval(intervaloCountdown);
                if (intervaloJuego) clearInterval(intervaloJuego);
                estadoJuego = 'esperando';
            }
        }
    });
});

const PUERTO = 3000;
http.listen(PUERTO, () => {
    console.log(`¡Servidor activado! Escuchando en el puerto ${PUERTO}`);
});
