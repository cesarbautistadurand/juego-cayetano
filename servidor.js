const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static(__dirname));

let jugadores = {}; 
let alienX = 0;
let alienY = 0;

let estadoJuego = 'esperando'; 
let segundosRestantes = 180;   // ⏱️ 3 MINUTOS DE JUEGO (60 seg por nivel)
let segundosCountdown = 10;    // ⏱️ 10 SEGUNDOS de espera en sala
let intervaloJuego = null;
let intervaloCountdown = null;
let timerMovimiento = null;
let nivelActual = 1;

function generarAlien() {
    alienX = Math.floor(Math.random() * 19) - 9; 
    alienY = Math.floor(Math.random() * 13) - 6;
    if(alienX === 0 && alienY === 0) generarAlien();
}

function enviarRanking() {
    let listaOrdenada = Object.values(jugadores).sort((a, b) => b.puntaje - a.puntaje);
    io.emit('actualizarRanking', listaOrdenada);
}

// LÓGICA DE MOVIMIENTO AUTOMÁTICO SEGÚN EL NIVEL
function reiniciarTimerMovimiento(nivel) {
    if(timerMovimiento) clearTimeout(timerMovimiento);
    
    let tiempo = 0;
    if(nivel === 1) tiempo = 2000; // Nivel 1: Se mueve cada 2 segundos (rápido para clicks)
    if(nivel === 3) tiempo = 5000; // Nivel 3: Se mueve cada 5 segundos (da tiempo a escribir)

    if(tiempo > 0 && estadoJuego === 'jugando') {
        timerMovimiento = setTimeout(() => {
            generarAlien();
            io.emit('movimientoAutomatico', { x: alienX, y: alienY });
            reiniciarTimerMovimiento(nivel);
        }, tiempo);
    }
}

function iniciarCountdown() {
    estadoJuego = 'countdown';
    segundosCountdown = 10; // ⏱️ 10 segundos antes de empezar

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
    segundosRestantes = 180; // 3 MINUTOS
    nivelActual = 1;
    generarAlien();
    
    io.emit('comenzarPartida', { x: alienX, y: alienY, nivel: nivelActual });
    reiniciarTimerMovimiento(nivelActual);

    if (intervaloJuego) clearInterval(intervaloJuego);
    intervaloJuego = setInterval(() => {
        segundosRestantes--;
        
        // CONTROL DE NIVELES POR TIEMPO
        let nuevoNivel = 1;
        if(segundosRestantes <= 120 && segundosRestantes > 60) nuevoNivel = 2;
        if(segundosRestantes <= 60) nuevoNivel = 3;

        if(nuevoNivel !== nivelActual) {
            nivelActual = nuevoNivel;
            io.emit('cambioNivel', nivelActual);
            reiniciarTimerMovimiento(nivelActual);
        }

        io.emit('actualizarReloj', segundosRestantes);

        if (segundosRestantes <= 0) {
            clearInterval(intervaloJuego);
            if(timerMovimiento) clearTimeout(timerMovimiento);
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
    }, 60000); // 1 minuto de podio
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
            socket.emit('comenzarPartida', { x: alienX, y: alienY, nivel: nivelActual });
        } else if (estadoJuego === 'terminado') {
            socket.emit('actualizarRanking', Object.values(jugadores).sort((a, b) => b.puntaje - a.puntaje));
        }
    });

    // Validar CLICKS (Solo válidos en Nivel 1)
    socket.on('disparoClick', (intento) => {
        if (!jugadores[socket.id] || estadoJuego !== 'jugando' || nivelActual !== 1) return;

        if (intento.x === alienX && intento.y === alienY) {
            jugadores[socket.id].puntaje += 100;
            generarAlien();
            reiniciarTimerMovimiento(nivelActual);
            
            io.emit('impactoCorrecto', { 
                nombreGanador: jugadores[socket.id].nombre,
                nuevoX: alienX, 
                nuevoY: alienY 
            });
            enviarRanking(); 
        }
    });

    // Validar TEXTO (Solo válidos en Nivel 2 y 3)
    socket.on('disparo', (intento) => {
        if (!jugadores[socket.id] || estadoJuego !== 'jugando' || nivelActual === 1) return;

        if (intento.x === alienX && intento.y === alienY) {
            jugadores[socket.id].puntaje += 100;
            generarAlien();
            reiniciarTimerMovimiento(nivelActual);
            
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
                if (timerMovimiento) clearTimeout(timerMovimiento);
                estadoJuego = 'esperando';
            }
        }
    });
});

const PUERTO = process.env.PORT || 3000;
http.listen(PUERTO, () => {
    console.log(`¡Servidor activado! Escuchando en el puerto ${PUERTO}`);
});
