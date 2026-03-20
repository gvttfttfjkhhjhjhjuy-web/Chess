var board = null;
var game = new Chess();
var stockfish = null;
var engineReady = false;
var engineInitialized = false;
var lastMoveTime = 0;

// Stockfish motorunu yükle
function loadEngine() {
    if (typeof Worker !== "undefined") {
        try {
            // ✅ DÜZELTME: Doğru Stockfish URL
            stockfish = new Worker('https://cdn.jsdelivr.net/npm/stockfish@11/dist/stockfish.js');
            
            stockfish.onmessage = function(event) {
                var line = event.data;
                console.log('Stockfish:', line);

                if (line.includes('readyok')) {
                    engineReady = true;
                    engineInitialized = true;
                    $('#engine-status').text("✅ Aktif");
                    $('#koc-mesaji').text("Motor hazır! İlk hamleni yap, usta bot seni bekliyor.");
                } else if (line.includes('score cp')) {
                    // ✅ DÜZELTME: Güvenli string parsing
                    try {
                        var parts = line.split('score cp ');
                        if (parts.length > 1) {
                            var scoreStr = parts[1].split(' ')[0];
                            var score = parseInt(scoreStr);
                            if (!isNaN(score)) {
                                score = score / 100;
                                if (game.turn() === 'b') score = -score;
                                guncelleEvalVisual(score);
                            }
                        }
                    } catch (e) {
                        console.error('Score parsing error:', e);
                    }
                } else if (line.includes('bestmove')) {
                    try {
                        var parts = line.split('bestmove ');
                        if (parts.length > 1) {
                            var bestMove = parts[1].split(' ')[0];
                            if (!game.game_over() && bestMove && bestMove.length >= 4) {
                                var move = game.move(bestMove, { sloppy: true });
                                if (move) {
                                    board.position(game.fen());
                                    durumGuncelle();
                                    setTimeout(analizBaslat, 500);
                                }
                            }
                        }
                    } catch (e) {
                        console.error('Best move error:', e);
                    }
                }
            };

            stockfish.onerror = function(error) {
                console.error('Worker Error:', error);
                $('#engine-status').text("❌ Hata").css('color', '#e74c3c');
                $('#koc-mesaji').text("Motor yüklenirken hata oluştu. Lütfen sayfayı yenileyin.");
            };

            // ✅ DÜZELTME: Doğru komut sırası
            stockfish.postMessage('ucinewgame');
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
    if (typeof score !== 'number') return;
    
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

    try {
        var move = game.move({ from: source, to: target, promotion: 'q' });
        if (move === null) return 'snapback';

        durumGuncelle();
        $('#koc-mesaji').text("🤖 Usta Bot hesaplıyor...");
        lastMoveTime = Date.now();
        
        if (stockfish && engineInitialized) {
            stockfish.postMessage('position fen ' + game.fen());
            
            var zorluk = $('#zorluk-seviyesi').val();
            if (zorluk) {
                stockfish.postMessage('setoption name Skill Level value ' + zorluk);
            }
            stockfish.postMessage('go depth 15');
        }
    } catch (e) {
        console.error('Move error:', e);
        return 'snapback';
    }
}

// Hamle sonrası analiz başlat
function analizBaslat() {
    if (!engineReady || game.game_over() || !stockfish || !engineInitialized) return;
    try {
        stockfish.postMessage('position fen ' + game.fen());
        stockfish.postMessage('go depth 12');
    } catch (e) {
        console.error('Analysis error:', e);
    }
}

// Oyun durumunu güncelle
function durumGuncelle() {
    try {
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
    } catch (e) {
        console.error('Status update error:', e);
    }
}

// Yeni oyun başlat
function yeniOyun() {
    try {
        game.reset();
        board.start();
        $('#eval-fill').css('height', '50%');
        $('#eval-text').text("0.0");
        $('#koc-mesaji').text("🎮 Yeni oyun başladı. Usta bota karşı stratejini belirle.");
        durumGuncelle();
        if (stockfish && engineInitialized) {
            stockfish.postMessage('ucinewgame');
        }
    } catch (e) {
        console.error('New game error:', e);
    }
}

// Tahta başlat
function initBoard() {
    try {
        var config = {
            draggable: true,
            position: 'start',
            onDrop: onDrop,
            onSnapEnd: function() { 
                if (board && game) {
                    board.position(game.fen());
                }
            },
            pieceTheme: 'https://unpkg.com/@chrisoakman/chessboardjs@1.0.0/dist/img/chesspieces/wikipedia/{piece}.png'
        };
        board = Chessboard('board', config);
    } catch (e) {
        console.error('Board initialization error:', e);
        $('#koc-mesaji').text("❌ HATA: Tahta başlatılamadı.");
    }
}

// Başlangıç
$(document).ready(function() {
    try {
        if (typeof Chessboard === 'undefined') {
            throw new Error('Chessboard kütüphanesi yüklenmedi');
        }
        if (typeof Chess === 'undefined') {
            throw new Error('Chess kütüphanesi yüklenmedi');
        }
        
        initBoard();
        loadEngine();
        durumGuncelle();
    } catch (e) {
        console.error('Initialization error:', e);
        $('#koc-mesaji').text("❌ HATA: Başlatma sırasında hata oluştu. Konsolu kontrol edin.");
    }
});