var board = null;
var game = new Chess();
var stockfish = null;
var engineReady = false;

// Stockfish motorunu yükle
function loadEngine() {
    if (typeof Worker !== "undefined") {
        try {
            stockfish = new Worker('https://cdn.jsdelivr.net/npm/stockfish@10.0.2/dist/stockfish.wasm.js');
            
            stockfish.onmessage = function(event) {
                var line = event.data;
                console.log('Stockfish:', line);

                if (line.includes('readyok')) {
                    engineReady = true;
                    $('#engine-status').text("✅ Aktif");
                    $('#koc-mesaji').text("Motor hazır! İlk hamleni yap, usta bot seni bekliyor.");
                } else if (line.includes('score cp')) {
                    var score = parseInt(line.split('score cp ')[1].split(' ')[0]) / 100;
                    if (game.turn() === 'b') score = -score;
                    guncelleEvalVisual(score);
                } else if (line.includes('bestmove')) {
                    var bestMove = line.split('bestmove ')[1].split(' ')[0];
                    if (!game.game_over()) {
                        game.move(bestMove, { sloppy: true });
                        board.position(game.fen());
                        durumGuncelle();
                        analizBaslat();
                    }
                }
            };

            stockfish.onerror = function(error) {
                console.error('Worker Error:', error);
                $('#engine-status').text("❌ Hata").css('color', '#e74c3c');
                $('#koc-mesaji').text("Motor yüklenirken hata oluştu. Lütfen sayfayı yenileyin.");
            };

            stockfish.postMessage('uci');
            stockfish.postMessage('isready');
        } catch (err) {
            console.error('Stockfish yükleme hatası:', err);
            $('#koc-mesaji').text("❌ HATA: Stockfish yüklenemedi. Lütfen sayfayı yenileyin.");
            $('#engine-status').text("Hatalı").css('color', '#e74c3c');
        }
    } else {
        $('#koc-mesaji').text("❌ HATA: Tarayıcınız Web Worker desteklemiyor.");
        $('#engine-status').text("Hatalı").css('color', '#e74c3c');
    }
}

// Değerlendirme çubuğunu güncelle
function guncelleEvalVisual(score) {
    $('#eval-text').text(score.toFixed(1));
    var percent = 50 - (score * 5);
    percent = Math.min(Math.max(percent, 5), 95);
    $('#eval-fill').css('height', percent + '%');
    
    // Koç mesajı
    if (score > 1.5) {
        $('#koc-mesaji').text("✅ Harika! Beyazın ciddi avantajı var.");
    } else if (score < -1.5) {
        $('#koc-mesaji').text("⚠️ Dikkat! Siyah (Bot) büyük avantaj elde etti.");
    } else if (Math.abs(score) < 0.5) {
        $('#koc-mesaji').text("⚖️ Dengeli pozisyon. Her hamle önemli!");
    }
}

// Oyuncu hamlesini işle
function onDrop(source, target) {
    if (!engineReady || game.game_over()) return 'snapback';

    var move = game.move({ from: source, to: target, promotion: 'q' });
    if (move === null) return 'snapback';

    durumGuncelle();
    $('#koc-mesaji').text("🤖 Usta Bot hesaplıyor...");
    
    if (stockfish) {
        stockfish.postMessage('position fen ' + game.fen());
        
        var zorluk = $('#zorluk-seviyesi').val();
        stockfish.postMessage('setoption name Skill Level value ' + zorluk);
        stockfish.postMessage('go depth 15');
    }
}

// Hamle sonrası analiz başlat
function analizBaslat() {
    if (!engineReady || game.game_over() || !stockfish) return;
    stockfish.postMessage('position fen ' + game.fen());
    stockfish.postMessage('go depth 12');
}

// Oyun durumunu güncelle
function durumGuncelle() {
    if (game.game_over()) {
        if (game.in_checkmate()) {
            $('#koc-mesaji').text("🏁 MAT! Oyun bitti.");
        } else if (game.in_draw()) {
            $('#koc-mesaji').text("🤝 BERABERE!");
        } else {
            $('#koc-mesaji').text("🏁 Oyun bitti.");
        }
        return;
    }
}

// Yeni oyun başlat
function yeniOyun() {
    game.reset();
    board.start();
    $('#eval-fill').css('height', '50%');
    $('#eval-text').text("0.0");
    $('#koc-mesaji').text("🎮 Yeni oyun başladı. Usta bota karşı stratejini belirle.");
    durumGuncelle();
    if (stockfish) stockfish.postMessage('ucinewgame');
}

// Tahta başlat
function initBoard() {
    var config = {
        draggable: true,
        position: 'start',
        onDrop: onDrop,
        onSnapEnd: function() { board.position(game.fen()) },
        pieceTheme: 'https://unpkg.com/@chrisoakman/chessboardjs@1.0.0/dist/img/chesspieces/wikipedia/{piece}.png'
    };
    board = Chessboard('board', config);
}

// Başlangıç
$(document).ready(function() {
    initBoard();
    loadEngine();
    durumGuncelle();
});