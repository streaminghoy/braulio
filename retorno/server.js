const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// HTML completo (copialo de abajo)
const HTML = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Retorno P2P</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', sans-serif; }
        body { background: #000; color: #fff; height: 100vh; overflow: hidden; }
        #loader { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: #000; display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 9999; }
        .spinner { width: 50px; height: 50px; border: 4px solid #222; border-top-color: #ff6b00; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 20px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        #broadcaster, #viewer { display: none; height: 100vh; flex-direction: column; }
        #broadcaster.active, #viewer.active { display: flex; }
        header { background: #111; padding: 15px; border-bottom: 2px solid #ff6b00; display: flex; justify-content: space-between; align-items: center; }
        .tag { background: #ff6b00; color: #000; padding: 5px 15px; border-radius: 20px; font-weight: bold; font-size: 14px; }
        .main { flex: 1; display: grid; grid-template-columns: 1fr 350px; overflow: hidden; }
        .left { padding: 20px; overflow-y: auto; }
        .right { background: #0a0a0a; border-left: 1px solid #333; padding: 20px; }
        .preview { background: #000; border: 2px solid #333; border-radius: 8px; aspect-ratio: 16/9; margin-bottom: 15px; position: relative; overflow: hidden; }
        .preview video { width: 100%; height: 100%; object-fit: contain; background: #000; }
        .live { position: absolute; top: 10px; right: 10px; background: #ff0000; color: #fff; padding: 5px 10px; border-radius: 4px; font-size: 12px; font-weight: bold; display: none; animation: pulse 2s infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.6} }
        button { padding: 12px 20px; background: #2a2a2a; border: none; color: #fff; border-radius: 6px; cursor: pointer; font-weight: 600; margin-right: 10px; margin-bottom: 10px; }
        button:hover:not(:disabled) { background: #3a3a3a; }
        button.primary { background: #ff6b00; color: #000; }
        button:disabled { opacity: 0.5; }
        .url-box { background: #141414; padding: 10px; border-radius: 6px; font-family: monospace; font-size: 12px; color: #aaa; word-break: break-all; margin: 10px 0; border-left: 3px solid #ff6b00; }
        #viewer video { width: 100%; height: 100%; object-fit: contain; background: #000; }
        #viewer .overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 10; transition: opacity 0.3s; }
        #viewer .overlay.hidden { opacity: 0; pointer-events: none; }
        .log { font-family: monospace; font-size: 11px; color: #666; margin-top: 10px; max-height: 150px; overflow-y: auto; }
        .log div { margin: 2px 0; border-bottom: 1px solid #1a1a1a; }
        .log .error { color: #f44; } .log .success { color: #4f4; }
        @media (max-width: 900px) { .main { grid-template-columns: 1fr; } .right { display: none; } }
    </style>
</head>
<body>

    <div id="loader">
        <div class="spinner"></div>
        <div>Iniciando sistema...</div>
    </div>

    <!-- EMISOR -->
    <div id="broadcaster">
        <header>
            <h1>📡 EMISOR</h1>
            <div class="tag" id="roomTag">SALA1</div>
        </header>
        <div class="main">
            <div class="left">
                <div class="preview">
                    <video id="localVideo" autoplay muted playsinline></video>
                    <div class="live" id="liveBadge">🔴 EN VIVO</div>
                </div>
                <div>
                    <button onclick="start('hd')" id="btn-hd" class="primary">🎥 HD 720p</button>
                    <button onclick="start('sd')" id="btn-sd" class="primary">📺 SD 480p</button>
                    <button onclick="stop()" id="btn-stop" disabled style="background:#ff0000;">⏹ Detener</button>
                </div>
                <div style="margin-top: 20px; background: #141414; padding: 15px; border-radius: 8px;">
                    <strong style="color: #ff6b00;">URL para reporteros:</strong>
                    <div class="url-box" id="shareUrl"></div>
                    <button onclick="copy()" style="width: 100%; margin-top: 10px;">📋 Copiar Link</button>
                </div>
                <div id="broadcasterLog" class="log"></div>
            </div>
            <div class="right">
                <div style="font-size: 32px; color: #ff6b00; font-weight: bold;" id="count">0</div>
                <div style="color: #666; font-size: 12px; margin-bottom: 20px;">REPORTEROS CONECTADOS</div>
                <div style="font-size: 13px; color: #888;" id="status">Esperando...</div>
            </div>
        </div>
    </div>

    <!-- RECEPTOR -->
    <div id="viewer">
        <video id="remoteVideo" autoplay playsinline></video>
        <div class="overlay" id="overlay">
            <div class="spinner"></div>
            <div style="font-size: 20px; font-weight: bold; margin: 15px 0;">Conectando...</div>
            <div style="color: #888;" id="mainStatus">Esperando señal del operador</div>
            <div style="margin-top: 20px; font-size: 12px; color: #555;" id="substatus">Inicializando...</div>
            <button onclick="location.reload()" style="margin-top: 20px; background: #ff6b00; color: #000; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">🔄 Reintentar</button>
        </div>
    </div>

    <script src="/socket.io/socket.io.js"></script>
    <script>
        const ROOM = 'sala1';
        const IS_VIEWER = location.search.includes('view=');
        const socket = io(IS_VIEWER ? {query: {room: ROOM, role: 'viewer'}} : {query: {room: ROOM, role: 'broadcaster'}});
        
        let stream;
        let pcs = new Map(); // Map<socketId, RTCPeerConnection>
        
        function log(msg, type='info') {
            console.log(msg);
            if (!IS_VIEWER) {
                const div = document.createElement('div');
                div.className = type;
                div.textContent = new Date().toLocaleTimeString() + ' - ' + msg;
                document.getElementById('broadcasterLog').prepend(div);
            } else {
                document.getElementById('substatus').innerHTML += '<br>' + msg;
            }
        }
        
        // UI init
        if (IS_VIEWER) {
            document.getElementById('viewer').classList.add('active');
            document.getElementById('loader').classList.add('hidden');
            initViewer();
        } else {
            document.getElementById('broadcaster').classList.add('active');
            document.getElementById('shareUrl').textContent = location.origin + '?view=' + ROOM;
            document.getElementById('loader').classList.add('hidden');
            log('Sistema listo');
        }
        
        // ========== EMISOR ==========
        async function start(quality) {
            const cons = quality === 'hd' 
                ? {video: {width: 1280, height: 720, frameRate: 30}, audio: true}
                : {video: {width: 854, height: 480, frameRate: 25}, audio: true};
            
            try {
                stream = await navigator.mediaDevices.getUserMedia(cons);
                document.getElementById('localVideo').srcObject = stream;
                document.getElementById('liveBadge').style.display = 'block';
                document.getElementById('btn-hd').disabled = true;
                document.getElementById('btn-sd').disabled = true;
                document.getElementById('btn-stop').disabled = false;
                document.getElementById('status').textContent = 'Transmitiendo...';
                document.getElementById('status').style.color = '#4f4';
                log('Cámara iniciada', 'success');
                
                socket.emit('register-broadcaster');
                
                // Escuchar viewers nuevos
                socket.on('new-viewer', (viewerId) => {
                    log('Nuevo viewer: ' + viewerId, 'success');
                    createOfferForViewer(viewerId);
                });
                
                // Recibir answer del viewer
                socket.on('answer', async (data) => {
                    if (pcs.has(data.viewerId)) {
                        await pcs.get(data.viewerId).setRemoteDescription(data.answer);
                        log('Answer recibida de ' + data.viewerId, 'success');
                    }
                });
                
                // Recibir ICE
                socket.on('ice-candidate', (data) => {
                    if (pcs.has(data.from)) {
                        pcs.get(data.from).addIceCandidate(new RTCIceCandidate(data.candidate));
                    }
                });
                
            } catch(e) {
                log('Error: ' + e.message, 'error');
                alert(e.message);
            }
        }
        
        function createOfferForViewer(viewerId) {
            const pc = new RTCPeerConnection({iceServers: [{urls: 'stun:stun.l.google.com:19302'}]});
            pcs.set(viewerId, pc);
            
            stream.getTracks().forEach(t => pc.addTrack(t, stream));
            
            pc.onicecandidate = (e) => {
                if (e.candidate) socket.emit('ice-candidate', {to: viewerId, candidate: e.candidate});
            };
            
            pc.createOffer()
                .then(offer => pc.setLocalDescription(offer))
                .then(() => socket.emit('offer', {to: viewerId, offer: pc.localDescription}));
        }
        
        function stop() {
            if (stream) stream.getTracks().forEach(t => t.stop());
            pcs.forEach(pc => pc.close());
            pcs.clear();
            socket.disconnect();
            location.reload();
        }
        
        function copy() {
            navigator.clipboard.writeText(document.getElementById('shareUrl').textContent);
            alert('Copiado!');
        }
        
        // ========== RECEPTOR ==========
        function initViewer() {
            let pc = null;
            
            socket.on('connect', () => {
                log('Conectado al servidor', 'success');
                socket.emit('register-viewer');
            });
            
            socket.on('broadcaster-online', () => {
                document.getElementById('mainStatus').textContent = 'Operador detectado';
                document.getElementById('substatus').textContent = 'Iniciando recepción...';
                
                // Crear RTCPeerConnection
                pc = new RTCPeerConnection({iceServers: [{urls: 'stun:stun.l.google.com:19302'}]});
                
                pc.ontrack = (e) => {
                    document.getElementById('remoteVideo').srcObject = e.streams[0];
                    document.getElementById('overlay').classList.add('hidden');
                    log('Video recibido!', 'success');
                };
                
                pc.onicecandidate = (e) => {
                    if (e.candidate) socket.emit('ice-candidate', {candidate: e.candidate});
                };
            });
            
            socket.on('broadcaster-offline', () => {
                document.getElementById('overlay').classList.remove('hidden');
                document.getElementById('mainStatus').textContent = 'Operador desconectado';
                if (pc) pc.close();
            });
            
            socket.on('offer', async (data) => {
                if (!pc) return;
                await pc.setRemoteDescription(data.offer);
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                socket.emit('answer', {answer: answer});
                log('Answer enviada', 'success');
            });
            
            socket.on('ice-candidate', (data) => {
                if (pc) pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            });
        }
    </script>
</body>
</html>`;

// Endpoint para servir HTML
app.get('/', (req, res) => res.send(HTML));
app.get('/view', (req, res) => res.send(HTML));

// Socket.io signaling
io.on('connection', (socket) => {
    const room = socket.handshake.query.room || 'default';
    const role = socket.handshake.query.role;
    
    socket.join(room);
    console.log(`[${room}] ${role} conectado: ${socket.id}`);
    
    // Cuando broadcaster se registra
    socket.on('register-broadcaster', () => {
        socket.broadcaster = true;
        // Notificar a viewers existentes
        io.to(room).except(socket.id).emit('broadcaster-online');
    });
    
    // Cuando viewer se registra
    socket.on('register-viewer', () => {
        // Buscar si hay broadcaster en la sala
        const roomSockets = io.sockets.adapter.rooms.get(room);
        let broadcasterOnline = false;
        
        if (roomSockets) {
            for (const socketId of roomSockets) {
                const s = io.sockets.sockets.get(socketId);
                if (s && s.broadcaster) {
                    broadcasterOnline = true;
                    s.emit('new-viewer', socket.id);
                }
            }
        }
        
        if (broadcasterOnline) {
            socket.emit('broadcaster-online');
        } else {
            socket.emit('broadcaster-offline');
        }
    });
    
    // Relay WebRTC
    socket.on('offer', (data) => {
        io.to(data.to).emit('offer', {offer: data.offer});
    });
    
    socket.on('answer', (data) => {
        // Enviar al broadcaster (que es el que envió el offer original)
        socket.to(room).emit('answer', {answer: data.answer, viewerId: socket.id});
    });
    
    socket.on('ice-candidate', (data) => {
        if (data.to) {
            io.to(data.to).emit('ice-candidate', {candidate: data.candidate, from: socket.id});
        } else {
            socket.to(room).emit('ice-candidate', {candidate: data.candidate, from: socket.id});
        }
    });
    
    socket.on('disconnect', () => {
        if (socket.broadcaster) {
            io.to(room).emit('broadcaster-offline');
        }
        console.log(`[${room}] Desconectado: ${socket.id}`);
    });
});

server.listen(process.env.PORT || 3000, () => {
    console.log('Servidor en puerto', process.env.PORT || 3000);
});
