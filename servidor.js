const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const fs = require('fs'); // Módulo para leer y escribir archivos
const path = './historial.json';

app.use(express.static(__dirname));

let historialPuntajes = {}; 

// CARGAR EL HISTORIAL GUARDADO AL INICIAR EL SERVIDOR
if (fs.existsSync(path)) {
    try {
        const datos = fs.readFileSync(path, 'utf8');
        historialPuntajes = JSON.parse(datos);
    } catch (error) {
        console.error("Error al leer el historial:", error);
    }
}

// FUNCIÓN PARA GUARDAR LOS PUNTOS PERMANENTEMENTE
function guardarHistorial() {
    fs.writeFileSync(path, JSON.stringify(historialPuntajes, null, 2));
}

let jugadores = {}; 
let alienX = 0;
let alienY = 0;

let estadoJuego = 'esperando'; 
let segundosRestantes = 180;   
let segundosCountdown = 10;    
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
    let listaOrdenada = Object.values(historialPuntajes).sort((a, b) => b.puntaje - a.puntaje);
    io.emit('actualizarRanking', listaOrdenada);
}

function reiniciarTimerMovimiento(nivel) {
    if(timerMovimiento) clearTimeout(timerMovimiento);
    
    let tiempo = 0;
    if(nivel === 1) tiempo = 2000; 
    if(nivel === 3) tiempo = 5000; 

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
    segundosCountdown = 10; 
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
    segundosRestantes = 180; 
    nivelActual = 1;
    generarAlien();
    
    io.emit('comenzarPartida', { x: alienX, y: alienY, nivel: nivelActual });
    reiniciarTimerMovimiento(nivelActual);

    if (intervaloJuego) clearInterval(intervaloJuego);
    intervaloJuego = setInterval(() => {
        segundosRestantes--;
        
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
    let listaOrdenada = Object.values(historialPuntajes).sort((a, b) => b.puntaje - a.puntaje);
    
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

    // NUEVO: Enviar historial completo a quien lo solicite desde el menú
    socket.on('solicitarHistorial', () => {
        let listaOrdenada = Object.values(historialPuntajes).sort((a, b) => b.puntaje - a.puntaje);
        socket.emit('historialCompleto', listaOrdenada);
    });
    
    socket.on('registrarJugador', (nombreAlumno) => {
        let key = nombreAlumno.trim().toUpperCase(); 
        
        if (!historialPuntajes[key]) {
            historialPuntajes[key] = { nombre: nombreAlumno.trim(), puntaje: 0 };
            guardarHistorial(); // Guardamos el nuevo usuario
        }
        
        jugadores[socket.id] = key;
        enviarRanking();

        if (estadoJuego === 'esperando') {
            iniciarCountdown();
        } else if (estadoJuego === 'countdown') {
            socket.emit('inicioCountdown', segundosCountdown);
        } else if (estadoJuego === 'jugando') {
            socket.emit('comenzarPartida', { x: alienX, y: alienY, nivel: nivelActual });
        } else if (estadoJuego === 'terminado') {
            socket.emit('actualizarRanking', Object.values(historialPuntajes).sort((a, b) => b.puntaje - a.puntaje));
        }
    });

    socket.on('disparoClick', (intento) => {
        if (!jugadores[socket.id] || estadoJuego !== 'jugando' || nivelActual !== 1) return;

        let key = jugadores[socket.id];

        if (intento.x === alienX && intento.y === alienY) {
            historialPuntajes[key].puntaje += 100;
            guardarHistorial(); // Guardamos los puntos al instante

            generarAlien();
            reiniciarTimerMovimiento(nivelActual);
            
            io.emit('impactoCorrecto', { 
                nombreGanador: historialPuntajes[key].nombre,
                nuevoX: alienX, 
                nuevoY: alienY 
            });
            enviarRanking(); 
        }
    });

    socket.on('disparo', (intento) => {
        if (!jugadores[socket.id] || estadoJuego !== 'jugando' || nivelActual === 1) return;

        let key = jugadores[socket.id];

        if (intento.x === alienX && intento.y === alienY) {
            historialPuntajes[key].puntaje += 100;
            guardarHistorial(); // Guardamos los puntos al instante

            generarAlien();
            reiniciarTimerMovimiento(nivelActual);
            
            io.emit('impactoCorrecto', { 
                nombreGanador: historialPuntajes[key].nombre,
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
