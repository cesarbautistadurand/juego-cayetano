const socket = io();

const pantallaLogin = document.getElementById("pantalla-login");
const inputNombre = document.getElementById("inputNombre");
const btnEntrar = document.getElementById("btnEntrar");
const pantallaJuego = document.getElementById("pantalla-juego");
const canvas = document.getElementById("plano");
const ctx = canvas.getContext("2d");
const inputCoords = document.getElementById("inputCoordenadas");
const btnDisparar = document.getElementById("btnDisparar");
const mensaje = document.getElementById("mensaje");
const listaRanking = document.getElementById("listaRanking");
const alertaCentral = document.getElementById("alerta-central");
const textoAlerta = document.getElementById("texto-alerta");
const reloj = document.getElementById("panel-reloj");

const centroX = canvas.width / 2;
const centroY = canvas.height / 2;
const escala = 30; 
let alienX = 0;
let alienY = 0;
let miNombre = "";
let mensajeTimer; 
let ultimoDisparoX = 0;
let ultimoDisparoY = 0;

function mostrarMensaje(texto, color) {
    mensaje.innerText = texto;
    mensaje.style.color = color;
    mensaje.style.opacity = "1"; 
    clearTimeout(mensajeTimer);
    mensajeTimer = setTimeout(() => { mensaje.style.opacity = "0"; }, 3000);
}

btnEntrar.addEventListener("click", () => {
    const nombre = inputNombre.value.trim();
    if (nombre !== "") {
        miNombre = nombre;
        pantallaLogin.style.display = "none";
        pantallaJuego.style.display = "flex";
        socket.emit('registrarJugador', miNombre);
    }
});

function dibujarPlano() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.strokeStyle = "#2c3e50"; 
    ctx.lineWidth = 1;
    for(let x = centroX % escala; x <= canvas.width; x += escala) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for(let y = centroY % escala; y <= canvas.height; y += escala) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }
    
    ctx.strokeStyle = "#F7B232";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, centroY); ctx.lineTo(canvas.width, centroY); ctx.stroke(); 
    ctx.beginPath(); ctx.moveTo(centroX, 0); ctx.lineTo(centroX, canvas.height); ctx.stroke(); 

    ctx.fillStyle = "#FFFFFF"; 
    ctx.font = "12px Arial";
    for(let x = -10; x <= 10; x++) {
        if(x !== 0) { 
            let px = centroX + (x * escala);
            ctx.fillText(x, px - 5, centroY + 15);
        }
    }
    for(let y = -6; y <= 6; y++) {
        if(y !== 0) {
            let py = centroY - (y * escala); 
            ctx.fillText(y, centroX + 8, py + 4);
        }
    }
    
    ctx.fillText("0", centroX + 5, centroY + 15);
    ctx.fillStyle = "#F7B232"; 
    ctx.font = "bold 16px Arial";
    ctx.fillText("X", canvas.width - 20, centroY - 10);
    ctx.fillText("Y", centroX - 25, 20);
}

function dibujarAlien(x, y) {
    const px = centroX + (x * escala);
    const py = centroY - (y * escala);
    ctx.fillStyle = "#5F1455"; 
    ctx.beginPath(); ctx.ellipse(px, py, 15, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#48dbfb"; 
    ctx.beginPath(); ctx.arc(px, py - 5, 8, Math.PI, 0); ctx.fill();
}

// Eventos de cuenta regresiva y estados
socket.on('inicioCountdown', (segundos) => {
    dibujarPlano();
    textoAlerta.innerHTML = `⚠️ PREPÁRENSE<br><span style="font-size: 50px; color: #F7B232;">${segundos}</span>`;
    alertaCentral.style.display = "flex";
});

socket.on('actualizarCountdown', (segundos) => {
    if (segundos > 0) {
        textoAlerta.innerHTML = `⚠️ COMIENZA EN<br><span style="font-size: 50px; color: #F7B232;">${segundos}</span>`;
        alertaCentral.style.display = "flex";
    } else {
        textoAlerta.innerHTML = `<span style="font-size: 45px; color: #50C878;">¡A BATALLAR!</span>`;
        setTimeout(() => {
            alertaCentral.style.display = "none";
        }, 1000);
    }
});

socket.on('comenzarPartida', (coordenadas) => {
    alienX = coordenadas.x;
    alienY = coordenadas.y;
    alertaCentral.style.display = "none";
    dibujarPlano();
    dibujarAlien(alienX, alienY);
    mostrarMensaje("¡Objetivo detectado! ¡Apunta rápido!", "#FFFFFF");
});

socket.on('actualizarReloj', (segundosRestantes) => {
    let minutos = Math.floor(segundosRestantes / 60);
    let segundos = segundosRestantes % 60;
    let formatoSegundos = segundos < 10 ? "0" + segundos : segundos;
    reloj.innerText = `⏱️ 0${minutos}:${formatoSegundos}`;
});

socket.on('impactoCorrecto', (datos) => {
    if (datos.nombreGanador === miNombre) {
        textoAlerta.innerHTML = "¡ACERTASTE!<br>+100 Puntos";
        textoAlerta.style.color = "#50C878";
    } else {
        textoAlerta.innerHTML = `¡SE TE ADELANTARON!<br><span style="color:#FFFFFF; font-size:22px;">${datos.nombreGanador.toUpperCase()} destruyó la nave</span>`;
        textoAlerta.style.color = "#F7B232"; 
    }
    
    alertaCentral.style.display = "flex";
    mensaje.style.opacity = "0"; 
    
    alienX = datos.nuevoX;
    alienY = datos.nuevoY;
    
    setTimeout(() => {
        alertaCentral.style.display = "none";
        dibujarPlano();
        dibujarAlien(alienX, alienY);
        mostrarMensaje("¡Nuevo objetivo detectado!", "#FFFFFF");
    }, 1500);
});

socket.on('finPartida', (datos) => {
    textoAlerta.innerHTML = `🏁 ¡FIN DE LA RONDA! 🏁<br><br>🏆 Ganador: <span style="color:#50C878;">${datos.ganador.toUpperCase()}</span><br><span style="font-size:22px; color:#F7B232;">Puntaje: ${datos.puntaje} pts</span>`;
    textoAlerta.style.color = "#FFFFFF";
    alertaCentral.style.display = "flex";
});

socket.on('fallo', (intento) => {
    mostrarMensaje(`Disparaste a X:${intento.x}, Y:${intento.y}. ¡Fallaste!`, "#F7B232");
    canvas.style.transform = "translateX(10px)";
    setTimeout(() => canvas.style.transform = "translateX(-10px)", 50);
    setTimeout(() => canvas.style.transform = "translateX(10px)", 100);
    setTimeout(() => canvas.style.transform = "translateX(0)", 150);
});

socket.on('actualizarRanking', (listaJugadores) => {
    listaRanking.innerHTML = "";
    listaJugadores.forEach((jugador, index) => {
        const li = document.createElement("li");
        let medalla = "";
        if (index === 0) medalla = "🥇 ";
        if (index === 1) medalla = "🥈 ";
        if (index === 2) medalla = "🥉 ";
        li.innerText = `${medalla}${jugador.nombre}: ${jugador.puntaje} pts`;
        listaRanking.appendChild(li);
    });
});

btnDisparar.addEventListener("click", () => {
    let valores = inputCoords.value.match(/-?\d+/g);
    
    if(!valores || valores.length !== 2) {
        mostrarMensaje("Usa el formato X,Y (Ej: 3,-2)", "#F7B232");
        return;
    }
    
    const intentoX = parseInt(valores[0]);
    const intentoY = parseInt(valores[1]);

    ultimoDisparoX = intentoX;
    ultimoDisparoY = intentoY;

    socket.emit('disparo', { x: intentoX, y: intentoY });
    inputCoords.value = "";
    inputCoords.focus(); 
});

inputCoords.addEventListener("keypress", function(event) {
    if (event.key === "Enter") btnDisparar.click();
});
inputNombre.addEventListener("keypress", function(event) {
    if (event.key === "Enter") btnEntrar.click();
});
