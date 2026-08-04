const socket = io();

const pantallaLogin = document.getElementById("pantalla-login");
const inputNombre = document.getElementById("inputNombre");
const btnEntrar = document.getElementById("btnEntrar");
const btnInstrucciones = document.getElementById("btnInstrucciones");
const modalInstrucciones = document.getElementById("modalInstrucciones");
const cerrarModal = document.getElementById("cerrarModal");

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

const imgMascota = new Image();
let mascotaCargada = false;
imgMascota.onload = () => { mascotaCargada = true; };
imgMascota.src = 'mascota.png';

btnInstrucciones.addEventListener("click", () => {
    modalInstrucciones.style.display = "flex";
});

cerrarModal.addEventListener("click", () => {
    modalInstrucciones.style.display = "none";
});

// MIRA TÁCTICA REDUCIDA Y PROPORCIONAL
function dibujarMira(targetCtx, x, y) {
    targetCtx.save();
    targetCtx.strokeStyle = "#00FF66"; // Verde neón táctico
    targetCtx.lineWidth = 1;
    
    let r = 3.5;
    targetCtx.beginPath();
    targetCtx.arc(x, y, r, 0, Math.PI * 2);
    targetCtx.stroke();
    
    let len = 2;
    targetCtx.beginPath();
    targetCtx.moveTo(x, y - r - len); targetCtx.lineTo(x, y - r);
    targetCtx.moveTo(x, y + r); targetCtx.lineTo(x, y + r + len);
    targetCtx.moveTo(x - r - len, y); targetCtx.lineTo(x - r, y);
    targetCtx.moveTo(x + r, y); targetCtx.lineTo(x + r + len, y);
    targetCtx.stroke();
    
    targetCtx.fillStyle = "#FFFFFF";
    targetCtx.beginPath();
    targetCtx.arc(x, y, 1, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.restore();
}

// ANIMACIÓN DE DEMOSTRACIÓN: NÍTIDA Y EN EL MISMO CUADRANTE (IV)
const demoCanvas = document.getElementById("demoCanvas");
if (demoCanvas) {
    const dCtx = demoCanvas.getContext("2d");
    dCtx.scale(2, 2); // Escala para máxima nitidez (HD)
    
    function animarDemo() {
        if (modalInstrucciones.style.display === "flex") {
            dCtx.clearRect(0, 0, 130, 100);
            
            const dcx = 130 / 2; // 65
            const dcy = 100 / 2; // 50

            dCtx.strokeStyle = "#F7B232";
            dCtx.lineWidth = 1;
            dCtx.beginPath();
            dCtx.moveTo(0, dcy);
            dCtx.lineTo(130, dcy);
            dCtx.moveTo(dcx, 0);
            dCtx.lineTo(dcx, 100);
            dCtx.stroke();

            // Posición exacta en el cuarto cuadrante (X positivo, Y negativo)
            let demoX = 2.5;
            let demoY = -1.8;
            let escalaDemo = 14;
            let px = dcx + (demoX * escalaDemo);
            let py = dcy - (demoY * escalaDemo);

            let tamañoDemo = 32;

            if (mascotaCargada) {
                dCtx.drawImage(imgMascota, px - tamañoDemo / 2, py - 14, tamañoDemo, tamañoDemo);
            } else {
                dCtx.fillStyle = "#50C878";
                dCtx.beginPath();
                dCtx.arc(px, py, 8, 0, Math.PI * 2);
                dCtx.fill();
            }

            dibujarMira(dCtx, px, py);

            // TEXTO (3 ; -2) COLOCADO EN EL MISMO CUADRANTE (IV), JUSTO AL LADO
            dCtx.fillStyle = "#FFFFFF";
            dCtx.font = "8px Poppins, Arial";
            dCtx.fillText("(3 ; -2)", px - 12, py + 24);
        }
        requestAnimationFrame(animarDemo);
    }
    animarDemo();
}

function mostrarMensaje(texto, color) {
    mensaje.innerText = texto;
    mensaje.style.color = color;
    mensaje.style.opacity = "1"; 
    clearTimeout(mensajeTimer);
    mensajeTimer = setTimeout(() => { mensaje.style.opacity = "0"; }, 1100);
}

btnEntrar.addEventListener("click", () => {
    const nombre = inputNombre.value.trim();
    if (nombre !== "") {
        miNombre = nombre;
        pantallaLogin.style.display = "none";
        pantallaJuego.style.display = "flex";
        mensaje.style.opacity = "0";
        dibujarPlano();
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
    ctx.font = "12px Poppins, Arial";
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
    ctx.font = "bold 16px Poppins, Arial";
    ctx.fillText("X", canvas.width - 20, centroY - 10);
    ctx.fillText("Y", centroX - 25, 20);
}

function dibujarAlien(x, y) {
    const px = centroX + (x * escala);
    const py = centroY - (y * escala);
    const tamaño = 45; 
    
    if (mascotaCargada) {
        ctx.drawImage(imgMascota, px - tamaño / 2, py - 16, tamaño, tamaño);
    } else {
        ctx.fillStyle = "#F7B232";
        ctx.beginPath();
        ctx.arc(px, py, 15, 0, Math.PI * 2);
        ctx.fill();
    }

    dibujarMira(ctx, px, py);
}

socket.on('inicioCountdown', (segundos) => {
    dibujarPlano();
    textoAlerta.innerHTML = `⚠️ PREPÁRENSE<br><span style="font-size: 45px; color: #F7B232;">${segundos}</span>`;
    alertaCentral.style.display = "flex";
});

socket.on('actualizarCountdown', (segundos) => {
    if (segundos > 0) {
        textoAlerta.innerHTML = `⚠️ COMIENZA EN<br><span style="font-size: 45px; color: #F7B232;">${segundos}</span>`;
        alertaCentral.style.display = "flex";
    } else {
        textoAlerta.innerHTML = `<span style="font-size: 35px; color: #50C878;">¡INICIAR PARTIDA!</span>`;
        setTimeout(() => {
            alertaCentral.style.display = "none";
        }, 800);
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
        textoAlerta.innerHTML = `¡SE TE ADELANTARON!<br><span style="color:#FFFFFF; font-size:18px;">${datos.nombreGanador.toUpperCase()} atrapó la mascota</span>`;
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
    }, 1000);
});

socket.on('finPartida', (datos) => {
    let podiumHtml = `🏆 ¡FIN DE LA PARTIDA! 🏆<br><br><span style="font-size:18px; color:#F7B232;">GANADORES</span><br><div style="font-size:13px; text-align:left; display:inline-block; margin-top:5px; line-height:1.4; max-height:220px; overflow-y:auto; padding:0 10px;">`;
    
    if (datos.ranking && datos.ranking.length > 0) {
        datos.ranking.forEach((j, index) => {
            let medalla = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}.`;
            let colorPuesto = index === 0 ? "#50C878" : "#FFFFFF";
            podiumHtml += `<span style="color:${colorPuesto};">${medalla} <b>${j.nombre}</b> (${j.puntaje} pts)</span><br>`;
        });
    } else {
        podiumHtml += `No hubo participantes.<br>`;
    }
    podiumHtml += `</div><br><span style="font-size:12px; color:#F7B232;">Nueva partida en breve...</span>`;

    textoAlerta.innerHTML = podiumHtml;
    textoAlerta.style.color = "#FFFFFF";
    alertaCentral.style.display = "flex";
});

socket.on('fallo', (intento) => {
    mostrarMensaje(`Disparaste a X:${intento.x}; Y:${intento.y}. ¡Fallaste!`, "#F7B232");
    canvas.style.transform = "translateX(8px)";
    setTimeout(() => canvas.style.transform = "translateX(-8px)", 40);
    setTimeout(() => canvas.style.transform = "translateX(8px)", 80);
    setTimeout(() => canvas.style.transform = "translateX(0)", 120);
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
        mostrarMensaje("Usa el formato X;Y (Ej: 3;-2)", "#F7B232");
        return;
    }
    
    const intentoX = parseInt(valores[0]);
    const intentoY = parseInt(valores[1]);

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
