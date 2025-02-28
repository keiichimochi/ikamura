document.addEventListener('DOMContentLoaded', function() {
    // キャンバスとコンテキストの取得
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    
    // ステージ画像の読み込み
    const stageImage = new Image();
    stageImage.src = '../src/assets/stage.png';
    
    // プレイヤー画像の読み込み
    const playerImage = new Image();
    playerImage.src = '../src/assets/player_idle_right.png';
    
    // コライダーデータ
    let colliders = [];
    let selectedCollider = null;
    let isDragging = false;
    let isDrawing = false;
    let startX, startY;
    let currentColliderType = 'solid'; // デフォルトは固体
    
    // プレイヤー開始位置
    let playerStartPos = { x: 83, y: 120.125 };
    let isSettingPlayerPos = false;
    
    // マウス座標
    let mouseX = 0;
    let mouseY = 0;
    
    // UI要素
    const addRectBtn = document.getElementById('addRectBtn');
    const addPlatformBtn = document.getElementById('addPlatformBtn');
    const addPitBtn = document.getElementById('addPitBtn');
    const addLadderBtn = document.getElementById('addLadderBtn');
    const selectedColliderControls = document.getElementById('selectedColliderControls');
    const noSelectionMessage = document.getElementById('noSelectionMessage');
    const colliderTypeSelect = document.getElementById('colliderType');
    const colliderXInput = document.getElementById('colliderX');
    const colliderYInput = document.getElementById('colliderY');
    const colliderWidthInput = document.getElementById('colliderWidth');
    const colliderHeightInput = document.getElementById('colliderHeight');
    const updateColliderBtn = document.getElementById('updateColliderBtn');
    const deleteColliderBtn = document.getElementById('deleteColliderBtn');
    const colliderListElement = document.getElementById('colliderList');
    const outputCodeElement = document.getElementById('outputCode');
    const copyCodeBtn = document.getElementById('copyCodeBtn');
    const loadCodeBtn = document.getElementById('loadCodeBtn');
    const loadCodeInput = document.getElementById('loadCodeInput');
    
    // プレイヤー位置関連のUI要素
    const setPlayerPosBtn = document.getElementById('setPlayerPosBtn');
    const playerXInput = document.getElementById('playerX');
    const playerYInput = document.getElementById('playerY');
    const updatePlayerPosBtn = document.getElementById('updatePlayerPosBtn');
    const playerMarker = document.getElementById('playerMarker');
    
    // 初期コライダーデータの読み込み
    loadInitialColliders();
    
    // ステージ画像の読み込み完了時の処理
    stageImage.onload = function() {
        // キャンバスのサイズをステージ画像に合わせる
        canvas.width = stageImage.width;
        canvas.height = stageImage.height;
        
        // 初期描画
        draw();
        
        // プレイヤーマーカーの位置を更新
        updatePlayerMarker();
    };
    
    // 初期コライダーデータの読み込み
    function loadInitialColliders() {
        // ゲームシーンから既存のコライダーデータを読み込む
        const initialColliders = [
            // 固体コライダー
            { x: 48, y: 170.125, width: 15, height: 13, type: 'solid' },
            { x: 239, y: 168.625, width: 16, height: 14, type: 'solid' },
            { x: 418, y: 170.625, width: 12, height: 12, type: 'solid' },
            { x: 526, y: 171.625, width: 17, height: 12, type: 'solid' },
            { x: 749, y: 169.625, width: 16, height: 13, type: 'solid' },
            { x: 960, y: 169.625, width: 14, height: 14, type: 'solid' },
            { x: 596, y: 106.125, width: 121, height: 13, type: 'solid' },
            { x: 737, y: 108.125, width: 173, height: 12, type: 'solid' },
            { x: 930, y: 105.125, width: 119, height: 17, type: 'solid' },
            { x: 765, y: 90.125, width: 16, height: 13, type: 'solid' },
            { x: 863, y: 89.125, width: 16, height: 16, type: 'solid' },
            { x: 960, y: 90.125, width: 15, height: 13, type: 'solid' },
            { x: 2, y: 185.125, width: 1045, height: 28, type: 'solid' },
        ];
        
        colliders = initialColliders;
        updateColliderList();
    }
    
    // 描画関数
    function draw() {
        // キャンバスをクリア
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // ステージ画像を描画
        ctx.drawImage(stageImage, 0, 0);
        
        // コライダーを描画
        colliders.forEach((collider, index) => {
            // コライダータイプに応じた色を設定
            switch(collider.type) {
                case 'solid':
                    ctx.strokeStyle = 'red';
                    ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
                    break;
                case 'platform':
                    ctx.strokeStyle = 'green';
                    ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
                    break;
                case 'pit':
                    ctx.strokeStyle = 'blue';
                    ctx.fillStyle = 'rgba(0, 0, 255, 0.3)';
                    break;
                case 'ladder':
                    ctx.strokeStyle = 'purple';
                    ctx.fillStyle = 'rgba(128, 0, 128, 0.3)';
                    break;
                default:
                    ctx.strokeStyle = 'white';
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            }
            
            // 選択されているコライダーは強調表示
            if (selectedCollider === collider) {
                ctx.lineWidth = 3;
            } else {
                ctx.lineWidth = 1;
            }
            
            // コライダーを描画
            ctx.fillRect(collider.x, collider.y, collider.width, collider.height);
            ctx.strokeRect(collider.x, collider.y, collider.width, collider.height);
            
            // コライダーのインデックスを表示
            ctx.fillStyle = 'white';
            ctx.font = '12px Arial';
            ctx.fillText(index + 1, collider.x + 5, collider.y + 15);
        });
        
        // 描画中のコライダーを描画
        if (isDrawing) {
            const width = mouseX - startX;
            const height = mouseY - startY;
            
            // コライダータイプに応じた色を設定
            switch(currentColliderType) {
                case 'solid':
                    ctx.strokeStyle = 'red';
                    ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
                    break;
                case 'platform':
                    ctx.strokeStyle = 'green';
                    ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
                    break;
                case 'pit':
                    ctx.strokeStyle = 'blue';
                    ctx.fillStyle = 'rgba(0, 0, 255, 0.3)';
                    break;
                case 'ladder':
                    ctx.strokeStyle = 'purple';
                    ctx.fillStyle = 'rgba(128, 0, 128, 0.3)';
                    break;
                default:
                    ctx.strokeStyle = 'white';
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            }
            
            ctx.lineWidth = 1;
            ctx.fillRect(startX, startY, width, height);
            ctx.strokeRect(startX, startY, width, height);
        }
        
        // プレイヤー開始位置を描画
        if (playerImage.complete) {
            const playerScale = 0.25; // プレイヤーのスケール
            const playerWidth = playerImage.width * playerScale;
            const playerHeight = playerImage.height * playerScale;
            ctx.globalAlpha = 0.7; // 半透明で描画
            ctx.drawImage(
                playerImage, 
                playerStartPos.x - (playerWidth / 2), 
                playerStartPos.y - playerHeight, 
                playerWidth, 
                playerHeight
            );
            ctx.globalAlpha = 1.0;
            
            // プレイヤー位置に十字マークを描画
            ctx.strokeStyle = '#2196F3';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(playerStartPos.x - 10, playerStartPos.y);
            ctx.lineTo(playerStartPos.x + 10, playerStartPos.y);
            ctx.moveTo(playerStartPos.x, playerStartPos.y - 10);
            ctx.lineTo(playerStartPos.x, playerStartPos.y + 10);
            ctx.stroke();
        }
        
        // コードを生成
        generateCode();
    }
    
    // プレイヤーマーカーの位置を更新
    function updatePlayerMarker() {
        const canvasRect = canvas.getBoundingClientRect();
        playerMarker.style.left = (canvasRect.left + playerStartPos.x) + 'px';
        playerMarker.style.top = (canvasRect.top + playerStartPos.y) + 'px';
        
        // 入力フィールドの更新
        playerXInput.value = playerStartPos.x;
        playerYInput.value = playerStartPos.y;
    }
    
    // コライダーの追加
    function addCollider(type) {
        currentColliderType = type;
        isSettingPlayerPos = false;
    }
    
    // プレイヤー位置設定モードの切り替え
    function togglePlayerPosMode() {
        isSettingPlayerPos = !isSettingPlayerPos;
        if (isSettingPlayerPos) {
            setPlayerPosBtn.textContent = 'キャンセル';
            playerMarker.style.display = 'block';
        } else {
            setPlayerPosBtn.textContent = 'プレイヤー開始位置を設定';
            playerMarker.style.display = 'none';
        }
    }
    
    // コライダーの選択
    function selectCollider(collider) {
        selectedCollider = collider;
        
        if (collider) {
            // 選択されたコライダーの情報をフォームに表示
            colliderTypeSelect.value = collider.type;
            colliderXInput.value = collider.x;
            colliderYInput.value = collider.y;
            colliderWidthInput.value = collider.width;
            colliderHeightInput.value = collider.height;
            
            // コントロールを表示
            selectedColliderControls.style.display = 'block';
            noSelectionMessage.style.display = 'none';
        } else {
            // 選択解除時はコントロールを非表示
            selectedColliderControls.style.display = 'none';
            noSelectionMessage.style.display = 'block';
        }
        
        // コライダーリストの更新
        updateColliderList();
        
        // 再描画
        draw();
    }
    
    // コライダーリストの更新
    function updateColliderList() {
        // リストをクリア
        colliderListElement.innerHTML = '';
        
        // コライダーをリストに追加
        colliders.forEach((collider, index) => {
            const item = document.createElement('div');
            item.className = 'collider-item';
            if (selectedCollider === collider) {
                item.className += ' selected';
            }
            
            // タイプに応じたラベルを設定
            let typeLabel = '';
            switch(collider.type) {
                case 'solid':
                    typeLabel = '固体';
                    break;
                case 'platform':
                    typeLabel = 'プラットフォーム';
                    break;
                case 'pit':
                    typeLabel = '落とし穴';
                    break;
                case 'ladder':
                    typeLabel = 'ハシゴ';
                    break;
                default:
                    typeLabel = '不明';
            }
            
            item.textContent = `${index + 1}: ${typeLabel} (${collider.x}, ${collider.y}, ${collider.width}, ${collider.height})`;
            
            // クリックイベントの追加
            item.addEventListener('click', function() {
                selectCollider(collider);
            });
            
            colliderListElement.appendChild(item);
        });
    }
    
    // コードの生成
    function generateCode() {
        let code = '// コライダーデータ\n';
        code += 'const colliders = [\n';
        
        // 固体コライダー
        const solidColliders = colliders.filter(c => c.type === 'solid');
        if (solidColliders.length > 0) {
            code += '  // 固体コライダー\n';
            solidColliders.forEach(collider => {
                code += `  { x: ${collider.x}, y: ${collider.y}, width: ${collider.width}, height: ${collider.height}, type: 'solid' },\n`;
            });
        }
        
        // プラットフォーム
        const platformColliders = colliders.filter(c => c.type === 'platform');
        if (platformColliders.length > 0) {
            code += '  // プラットフォーム\n';
            platformColliders.forEach(collider => {
                code += `  { x: ${collider.x}, y: ${collider.y}, width: ${collider.width}, height: ${collider.height}, type: 'platform' },\n`;
            });
        }
        
        // 落とし穴
        const pitColliders = colliders.filter(c => c.type === 'pit');
        if (pitColliders.length > 0) {
            code += '  // 落とし穴\n';
            pitColliders.forEach(collider => {
                code += `  { x: ${collider.x}, y: ${collider.y}, width: ${collider.width}, height: ${collider.height}, type: 'pit' },\n`;
            });
        }

        // ハシゴ
        const ladderColliders = colliders.filter(c => c.type === 'ladder');
        if (ladderColliders.length > 0) {
            code += '  // ハシゴ\n';
            ladderColliders.forEach(collider => {
                code += `  { x: ${collider.x}, y: ${collider.y}, width: ${collider.width}, height: ${collider.height}, type: 'ladder' },\n`;
            });
        }
        
        code += '];\n\n';
        
        // プレイヤー開始位置
        code += '// プレイヤー開始位置\n';
        code += `const playerStartPosition = { x: ${playerStartPos.x}, y: ${playerStartPos.y} };\n\n`;
        
        // Phaserでの使用例
        code += '// Phaserでの使用例\n';
        code += 'function createColliders() {\n';
        code += '  // 固体コライダーの作成\n';
        code += '  colliders.filter(c => c.type === \'solid\').forEach(collider => {\n';
        code += '    const solid = this.platforms.create(collider.x, collider.y, \'ground\');\n';
        code += '    solid.setOrigin(0, 0);\n';
        code += '    solid.setDisplaySize(collider.width, collider.height);\n';
        code += '    solid.refreshBody();\n';
        code += '    solid.visible = false; // 見えないようにする（デバッグ時はコメントアウト）\n';
        code += '  });\n\n';
        
        code += '  // プラットフォームの作成\n';
        code += '  colliders.filter(c => c.type === \'platform\').forEach(collider => {\n';
        code += '    const platform = this.platforms.create(collider.x, collider.y, \'ground\');\n';
        code += '    platform.setOrigin(0, 0);\n';
        code += '    platform.setDisplaySize(collider.width, collider.height);\n';
        code += '    platform.refreshBody();\n';
        code += '    platform.body.checkCollision.down = false;\n';
        code += '    platform.body.checkCollision.left = false;\n';
        code += '    platform.body.checkCollision.right = false;\n';
        code += '    platform.visible = false; // 見えないようにする（デバッグ時はコメントアウト）\n';
        code += '  });\n\n';
        
        code += '  // 落とし穴の作成\n';
        code += '  colliders.filter(c => c.type === \'pit\').forEach(collider => {\n';
        code += '    const pit = this.add.zone(collider.x, collider.y, collider.width, collider.height);\n';
        code += '    this.physics.world.enable(pit, Phaser.Physics.Arcade.STATIC_BODY);\n';
        code += '    pit.body.setAllowGravity(false);\n';
        code += '    this.physics.add.overlap(this.player, pit, this.playerFallIntoPit, null, this);\n';
        code += '  });\n\n';

        code += '  // ハシゴの作成\n';
        code += '  this.ladders = this.physics.add.staticGroup();\n';
        code += '  colliders.filter(c => c.type === \'ladder\').forEach(collider => {\n';
        code += '    const ladder = this.ladders.create(collider.x, collider.y, \'ground\');\n';
        code += '    ladder.setOrigin(0, 0);\n';
        code += '    ladder.setDisplaySize(collider.width, collider.height);\n';
        code += '    ladder.refreshBody();\n';
        code += '    ladder.visible = false; // 見えないようにする（デバッグ時はコメントアウト）\n';
        code += '  });\n';
        code += '  this.physics.add.overlap(this.player, this.ladders, this.handleLadderOverlap, null, this);\n';
        code += '}\n\n';
        
        code += '// プレイヤーが落とし穴に落ちた時の処理\n';
        code += 'function playerFallIntoPit(player, pit) {\n';
        code += '  console.log(\'Player fell into pit!\');\n';
        code += '  this.scene.restart();\n';
        code += '}\n\n';

        code += '// ハシゴとの接触処理\n';
        code += 'function handleLadderOverlap(player, ladder) {\n';
        code += '  this.isOnLadder = true;\n';
        code += '  if (this.cursors.up.isDown) {\n';
        code += '    player.setVelocityY(-100);\n';
        code += '    player.anims.play(\'climb\', true);\n';
        code += '  } else if (this.cursors.down.isDown) {\n';
        code += '    player.setVelocityY(100);\n';
        code += '    player.anims.play(\'climb\', true);\n';
        code += '  } else {\n';
        code += '    player.setVelocityY(0);\n';
        code += '    player.anims.stop();\n';
        code += '  }\n';
        code += '}\n\n';
        
        code += '// プレイヤーの作成\n';
        code += 'function createPlayer() {\n';
        code += `  this.player = this.physics.add.sprite(playerStartPosition.x, playerStartPosition.y, 'player_idle_right');\n`;
        code += '  this.player.setScale(0.25);\n';
        code += '  this.player.setBounce(0.1);\n';
        code += '  this.player.setCollideWorldBounds(true);\n';
        code += '  this.player.body.setSize(this.player.width * 0.7, this.player.height * 0.9);\n';
        code += '  this.player.body.setOffset(this.player.width * 0.15, this.player.height * 0.1);\n';
        code += '}\n';
        
        // コードを表示
        outputCodeElement.value = code;
    }
    
    // コードからコライダーを読み込む
    function loadCollidersFromCode(code) {
        try {
            // コードからコライダーデータを抽出
            const colliderRegex = /{\s*x:\s*(\d+\.?\d*),\s*y:\s*(\d+\.?\d*),\s*width:\s*(\d+\.?\d*),\s*height:\s*(\d+\.?\d*),\s*type:\s*'(\w+)'\s*}/g;
            const playerPosRegex = /playerStartPosition\s*=\s*{\s*x:\s*(\d+\.?\d*),\s*y:\s*(\d+\.?\d*)\s*}/;
            
            // コライダーデータを抽出
            const newColliders = [];
            let match;
            while ((match = colliderRegex.exec(code)) !== null) {
                newColliders.push({
                    x: parseFloat(match[1]),
                    y: parseFloat(match[2]),
                    width: parseFloat(match[3]),
                    height: parseFloat(match[4]),
                    type: match[5]
                });
            }
            
            // プレイヤー開始位置を抽出
            const playerMatch = playerPosRegex.exec(code);
            if (playerMatch) {
                playerStartPos = {
                    x: parseFloat(playerMatch[1]),
                    y: parseFloat(playerMatch[2])
                };
                updatePlayerMarker();
            }
            
            // 抽出したデータが有効な場合は更新
            if (newColliders.length > 0) {
                colliders = newColliders;
                updateColliderList();
                draw();
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('コードの解析中にエラーが発生しました:', error);
            return false;
        }
    }
    
    // イベントリスナーの設定
    
    // ボタンクリック時の処理
    addRectBtn.addEventListener('click', function() {
        addCollider('solid');
    });
    
    addPlatformBtn.addEventListener('click', function() {
        addCollider('platform');
    });
    
    addPitBtn.addEventListener('click', function() {
        addCollider('pit');
    });

    addLadderBtn.addEventListener('click', function() {
        addCollider('ladder');
    });
    
    // プレイヤー位置設定ボタン
    setPlayerPosBtn.addEventListener('click', function() {
        togglePlayerPosMode();
    });
    
    // プレイヤー位置更新ボタン
    updatePlayerPosBtn.addEventListener('click', function() {
        playerStartPos.x = parseInt(playerXInput.value);
        playerStartPos.y = parseInt(playerYInput.value);
        updatePlayerMarker();
        draw();
    });
    
    // コライダー更新ボタン
    updateColliderBtn.addEventListener('click', function() {
        if (selectedCollider) {
            selectedCollider.type = colliderTypeSelect.value;
            selectedCollider.x = parseInt(colliderXInput.value);
            selectedCollider.y = parseInt(colliderYInput.value);
            selectedCollider.width = parseInt(colliderWidthInput.value);
            selectedCollider.height = parseInt(colliderHeightInput.value);
            
            // コライダーリストの更新
            updateColliderList();
            
            // 再描画
            draw();
        }
    });
    
    // コライダー削除ボタン
    deleteColliderBtn.addEventListener('click', function() {
        if (selectedCollider) {
            // コライダーを削除
            const index = colliders.indexOf(selectedCollider);
            if (index !== -1) {
                colliders.splice(index, 1);
            }
            
            // 選択解除
            selectCollider(null);
            
            // 再描画
            draw();
        }
    });
    
    // コードコピーボタン
    copyCodeBtn.addEventListener('click', function() {
        outputCodeElement.select();
        document.execCommand('copy');
        alert('コードがクリップボードにコピーされました！');
    });
    
    // コード読み込みボタン
    if (loadCodeBtn) {
        loadCodeBtn.addEventListener('click', function() {
            const code = loadCodeInput.value;
            if (code.trim() === '') {
                alert('コードを入力してください');
                return;
            }
            
            const success = loadCollidersFromCode(code);
            if (success) {
                alert('コードからコライダーを読み込みました');
            } else {
                alert('コードの解析に失敗しました。正しいフォーマットか確認してください');
            }
        });
    }
    
    // キャンバスのマウスイベント
    canvas.addEventListener('mousedown', function(e) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // プレイヤー位置設定モードの場合
        if (isSettingPlayerPos) {
            playerStartPos.x = x;
            playerStartPos.y = y;
            updatePlayerMarker();
            draw();
            return;
        }
        
        // コライダーの選択チェック
        let found = false;
        for (let i = colliders.length - 1; i >= 0; i--) {
            const collider = colliders[i];
            if (x >= collider.x && x <= collider.x + collider.width &&
                y >= collider.y && y <= collider.y + collider.height) {
                selectCollider(collider);
                isDragging = true;
                found = true;
                
                // ドラッグ開始位置の記録
                startX = x - collider.x;
                startY = y - collider.y;
                break;
            }
        }
        
        // 何も選択されていない場合は新しいコライダーの描画開始
        if (!found) {
            isDrawing = true;
            startX = x;
            startY = y;
            selectCollider(null);
        }
    });
    
    canvas.addEventListener('mousemove', function(e) {
        const rect = canvas.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;
        
        if (isDragging && selectedCollider) {
            // 選択されたコライダーをドラッグ
            selectedCollider.x = mouseX - startX;
            selectedCollider.y = mouseY - startY;
            
            // 入力フィールドの更新
            colliderXInput.value = selectedCollider.x;
            colliderYInput.value = selectedCollider.y;
            
            // 再描画
            draw();
        } else if (isDrawing) {
            // 新しいコライダーの描画
            draw();
        }
    });
    
    canvas.addEventListener('mouseup', function(e) {
        if (isDrawing) {
            // 新しいコライダーの作成
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // 幅と高さの計算（負の値を考慮）
            let newX = startX;
            let newY = startY;
            let newWidth = x - startX;
            let newHeight = y - startY;
            
            if (newWidth < 0) {
                newX = x;
                newWidth = Math.abs(newWidth);
            }
            
            if (newHeight < 0) {
                newY = y;
                newHeight = Math.abs(newHeight);
            }
            
            // 最小サイズのチェック
            if (newWidth >= 5 && newHeight >= 5) {
                const newCollider = {
                    x: newX,
                    y: newY,
                    width: newWidth,
                    height: newHeight,
                    type: currentColliderType
                };
                
                colliders.push(newCollider);
                selectCollider(newCollider);
            }
        }
        
        // ドラッグと描画の終了
        isDragging = false;
        isDrawing = false;
        
        // 再描画
        draw();
    });
    
    // 初期化
    updateColliderList();
    draw();
}); 