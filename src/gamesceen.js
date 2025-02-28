import Phaser from 'phaser';

class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
        this.player = null;
        this.platforms = null;
        this.ladders = null;  // ハシゴグループを追加
        this.cursors = null;
        this.isJumping = false;
        this.isCrouching = false;
        this.isOnLadder = false;  // ハシゴ上フラグを追加
        this.playerDirection = 'right';
        this.playerState = 'idle'; // プレイヤーの状態を追加（idle, running, jumping, crouching, climbing）
        
        // 地面判定を安定させるための変数を追加
        this.groundedTime = 0;     // 接地状態が続いている時間
        this.airborneTime = 0;     // 空中状態が続いている時間
        this.groundBufferTime = 100; // 接地判定の猶予時間（ミリ秒）- 値を小さくして安定化
        this.jumpBufferTime = 200;   // ジャンプ入力の猶予時間（ミリ秒）
        this.lastJumpTime = 0;     // 最後にジャンプした時間
        this.stateChangeThreshold = 300; // 状態変化の閾値（ミリ秒）- 値を大きくして安定化
        
        // 状態変化の履歴を保持する配列（より長く保持）
        this.stateHistory = [];
        this.stateHistoryMaxLength = 5;
        
        this.groundData = [];
        this.waterTiles = [];
        this.pitAreas = [[6, 7], [12, 13], [18, 20]];
        this.playerStartPosition = { x: 83, y: 120.125 };
        // サウンド関連の変数
        this.bgm = null;
        this.jumpSound = null;
        this.hasSoundSystem = false;
        this.isSoundOn = false;  // 初期状態はオフ
    }

    preload() {
        // プレイヤー画像のロード
        this.load.image('player_idle_right', 'src/assets/player_idle_right.png');
        this.load.image('player_crouch', 'src/assets/player_crouch.png');
        this.load.image('player_jump_right0', 'src/assets/player_jump_right0.png');
        this.load.image('player_jump_right1', 'src/assets/player_jump_right1.png');
        
        // ハシゴ用の画像をロード
        this.load.image('player_climbing', 'src/assets/player_climbing.png');
        
        // 走るアニメーション用の画像をロード
        for (let i = 0; i < 3; i++) {
            this.load.image(`player_run_right${i}`, `src/assets/player_run_right${i}.png`);
        }
        
        // 地面とその他のゲーム要素
        this.load.image('ground', 'src/assets/ground.png');
        this.load.image('water', 'src/assets/water.png');
        this.load.image('stage', 'src/assets/stage.png');
        
        // サウンドファイルのロード
        this.load.audio('jump', ['src/assets/sound/jump.mp3', 'src/assets/sound/jump.wav']);
        this.load.audio('bgm', 'src/assets/sound/stage1.mp3');
        
        console.log('サウンドファイルのロードを開始しました');
    }

    create() {
        // 物理世界の境界を設定
        this.physics.world.setBounds(0, 0, 1200, 240);
        
        // 重力を設定 - 少し弱めに調整
        this.physics.world.gravity.y = 480;
        
        // 物理エンジンの設定を調整
        this.physics.world.TILE_BIAS = 40; // タイルのバイアス値を増やして衝突検出を強化
        
        // ステージ背景を追加（表示サイズは変更しない）
        this.add.image(0, 0, 'stage')
            .setOrigin(0, 0);
        
        // サウンドシステムの初期化
        this.initSoundSystem();
        
        // BGMを再生（サウンドシステムが利用可能な場合のみ）
        if (this.hasSoundSystem && this.bgm) {
            try {
                this.bgm.play();
                console.log('BGMの再生を開始しました');
            } catch (error) {
                console.error('BGMの再生に失敗しました:', error);
            }
        }
        
        // カメラの設定（ファミコンサイズに合わせる）
        this.cameras.main.setBounds(0, 0, 1200, 240);
        this.cameras.main.setZoom(2);  // ズームレベルを2倍に設定（ファミコンサイズに近づける）
        
        // 地面のグループを作成
        this.platforms = this.physics.add.staticGroup();
        
        // ハシゴのグループを作成
        this.ladders = this.physics.add.staticGroup();
        
        // 地面データの生成
        this.generateGroundData();
        
        // 地面の作成
        this.createGround();
        
        // プレイヤーの作成（ここで一度だけ作成）
        this.createPlayer();
        
        // コライダーの作成
        this.createColliders();
        
        // アニメーションの作成
        this.createAnimations();
        
        // キーボード入力の設定
        this.cursors = this.input.keyboard.createCursorKeys();
        
        // プレイヤーと地面の衝突を設定 - プロセスコールバックを追加
        this.physics.add.collider(
            this.player, 
            this.platforms, 
            null, 
            (player, platform) => {
                // プレイヤーが下から上に移動している場合は衝突を無効化
                if (player.body.velocity.y < 0 && player.y > platform.y + platform.height) {
                    return false;
                }
                // それ以外の場合は衝突を有効化
                return true;
            }, 
            this
        );
        
        // プレイヤーとハシゴのオーバーラップを設定
        this.physics.add.overlap(this.player, this.ladders, this.handleLadderOverlap, null, this);
        
        // サウンドトグルボタンを作成（ゲーム内のボタン）
        this.createSoundToggleButton();
        
        // デバッグ情報を表示
        console.log(`カメラ情報: 幅=${this.cameras.main.width}, 高さ=${this.cameras.main.height}, ズーム=${this.cameras.main.zoom}`);
        console.log(`ゲーム画面サイズ: 幅=${this.game.config.width}, 高さ=${this.game.config.height}`);
        
        // ゲームキャンバスの下にHTMLボタンを追加
        this.createHTMLSoundButton();
    }
    
    // HTMLボタンを作成（ゲームキャンバスの外側に配置）
    createHTMLSoundButton() {
        // ゲームのキャンバス要素を取得
        const gameCanvas = this.sys.game.canvas;
        
        // HTMLボタンを作成
        const soundButton = document.createElement('button');
        soundButton.innerHTML = '🔊 サウンド: OFF';
        soundButton.style.position = 'absolute';
        soundButton.style.left = '50%';
        soundButton.style.transform = 'translateX(-50%)';
        soundButton.style.top = `${gameCanvas.offsetTop + gameCanvas.offsetHeight + 10}px`;
        soundButton.style.padding = '10px 20px';
        soundButton.style.fontSize = '24px';
        soundButton.style.fontWeight = 'bold';
        soundButton.style.backgroundColor = '#000000';
        soundButton.style.color = '#FF3333';
        soundButton.style.border = '4px solid #FF3333';
        soundButton.style.borderRadius = '10px';
        soundButton.style.cursor = 'pointer';
        soundButton.style.zIndex = '1000';
        soundButton.style.fontFamily = 'Arial, sans-serif';
        
        // ボタンのホバーエフェクト
        soundButton.onmouseover = () => {
            soundButton.style.backgroundColor = '#333333';
            soundButton.style.color = '#FFFF00';
            soundButton.style.border = '4px solid #FFFF00';
        };
        
        soundButton.onmouseout = () => {
            if (this.isSoundOn) {
                soundButton.style.backgroundColor = '#000000';
                soundButton.style.color = '#00FF00';
                soundButton.style.border = '4px solid #00FF00';
            } else {
                soundButton.style.backgroundColor = '#000000';
                soundButton.style.color = '#FF3333';
                soundButton.style.border = '4px solid #FF3333';
            }
        };
        
        // クリックイベントを追加
        soundButton.onclick = () => {
            this.toggleSound();
            
            // ボタンの表示を更新
            if (this.isSoundOn) {
                soundButton.innerHTML = '🔊 サウンド: ON';
                soundButton.style.color = '#00FF00';
                soundButton.style.border = '4px solid #00FF00';
            } else {
                soundButton.innerHTML = '🔊 サウンド: OFF';
                soundButton.style.color = '#FF3333';
                soundButton.style.border = '4px solid #FF3333';
            }
        };
        
        // ゲームキャンバスの親要素にボタンを追加
        gameCanvas.parentNode.appendChild(soundButton);
        
        // ボタン要素を保存
        this.htmlSoundButton = soundButton;
        
        console.log('HTMLサウンドボタンを作成しました');
        console.log(`ボタン位置: top=${gameCanvas.offsetTop + gameCanvas.offsetHeight + 10}px`);
        
        // ウィンドウリサイズ時にボタン位置を調整
        window.addEventListener('resize', () => {
            soundButton.style.top = `${gameCanvas.offsetTop + gameCanvas.offsetHeight + 10}px`;
            console.log(`ボタン位置を更新: top=${gameCanvas.offsetTop + gameCanvas.offsetHeight + 10}px`);
        });
    }

    // コライダーデータ
    colliders = [
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
        // ハシゴ
        { x: 720, y: 108.5625, width: 13, height: 75, type: 'ladder' },
        { x: 913, y: 110.5625, width: 13, height: 73, type: 'ladder' },
        { x: 1071, y: 108.5625, width: 14, height: 74, type: 'ladder' },
    ];
    
    // コライダーの作成
    createColliders() {
        // 固体コライダーの作成
        this.colliders.filter(c => c.type === 'solid').forEach(collider => {
            const solid = this.platforms.create(collider.x, collider.y, 'ground');
            solid.setOrigin(0, 0);
            solid.setDisplaySize(collider.width, collider.height);
            solid.refreshBody();
            // 衝突反応を強化（上からの衝突を強制的に有効に）
            solid.body.checkCollision.up = true;
            solid.body.checkCollision.down = false; // 下からは通過可能
            solid.body.immovable = true;  // 固定
            solid.visible = false; // 見えないようにする（デバッグ時はコメントアウト）
        });
        
        // プラットフォームの作成
        this.colliders.filter(c => c.type === 'platform').forEach(collider => {
            const platform = this.platforms.create(collider.x, collider.y, 'ground');
            platform.setOrigin(0, 0);
            platform.setDisplaySize(collider.width, collider.height);
            platform.refreshBody();
            platform.body.checkCollision.down = false;
            platform.body.checkCollision.left = false;
            platform.body.checkCollision.right = false;
            platform.body.immovable = true;  // 固定
            platform.visible = false; // 見えないようにする（デバッグ時はコメントアウト）
        });
        
        // 落とし穴の作成
        this.colliders.filter(c => c.type === 'pit').forEach(collider => {
            const pit = this.add.zone(collider.x, collider.y, collider.width, collider.height);
            this.physics.world.enable(pit, Phaser.Physics.Arcade.STATIC_BODY);
            pit.body.setAllowGravity(false);
            this.physics.add.overlap(this.player, pit, this.playerFallIntoPit, null, this);
        });

        // ハシゴの作成
        this.colliders.filter(c => c.type === 'ladder').forEach(collider => {
            const ladder = this.ladders.create(collider.x, collider.y, 'ground');
            ladder.setOrigin(0, 0);
            ladder.setDisplaySize(collider.width, collider.height);
            ladder.refreshBody();
            ladder.visible = false; // 見えないようにする（デバッグ時はコメントアウト）
        });
    }
    
    // プレイヤーが落とし穴に落ちた時の処理
    playerFallIntoPit(player, pit) {
        console.log('Player fell into pit!');
        // BGMを停止してからシーンをリスタート（サウンドシステムが利用可能な場合のみ）
        if (this.hasSoundSystem && this.bgm) {
            try {
                this.bgm.stop();
            } catch (error) {
                console.log('BGMの停止に失敗しました:', error);
            }
        }
        this.scene.restart();
    }

    // ハシゴとの接触処理
    handleLadderOverlap(player, ladder) {
        this.isOnLadder = true;
        
        // ハシゴ上では重力を無効化
        player.body.setAllowGravity(false);
        
        // ハシゴ上での移動処理
        if (this.cursors.up.isDown) {
            player.setVelocityY(-100);
            player.anims.play('climb', true);
        } else if (this.cursors.down.isDown) {
            player.setVelocityY(100);
            player.anims.play('climb', true);
        } else {
            player.setVelocityY(0);
            // アニメーションを停止し、ハシゴ用の静止画像を表示
            player.anims.stop();
            player.setTexture('player_climbing');
        }
    }

    // 地面データの生成
    generateGroundData() {
        // 地面データの生成
        this.groundData = [
            // メインの地面
            { x: 0, y: 185, width: 1200, height: 55 },
        ];
        
        // 水たまりデータの生成
        this.waterTiles = [];
        for (const area of this.pitAreas) {
            const startX = area[0] * 16;
            const endX = area[1] * 16;
            const width = endX - startX;
            this.waterTiles.push({ x: startX, y: 185, width: width, height: 16 });
        }
    }

    createGround() {
        // 地面データに基づいて地面を作成
        for (const data of this.groundData) {
            const ground = this.platforms.create(data.x, data.y, 'ground');
            ground.setOrigin(0, 0);
            ground.setDisplaySize(data.width, data.height);
            ground.refreshBody();
            ground.setImmovable(true);
            // 衝突反応を強化
            ground.body.checkCollision.up = true;
            ground.body.checkCollision.down = false;
        }
        
        // 水タイルの作成
        for (const water of this.waterTiles) {
            this.add.image(water.x, water.y, 'water')
                .setOrigin(0, 0)
                .setDisplaySize(water.width, water.height);
        }
    }

    createPlayer() {
        // プレイヤーの作成（ここで一度だけ作成）
        this.player = this.physics.add.sprite(this.playerStartPosition.x, this.playerStartPosition.y, 'player_idle_right');
        this.player.setScale(0.25);
        this.player.setBounce(0.0); // バウンス値を0に設定して地面との接触を安定させる
        this.player.setCollideWorldBounds(true);
        
        // プレイヤーの物理特性を調整
        this.player.body.setSize(this.player.width * 0.7, this.player.height * 0.9);
        this.player.body.setOffset(this.player.width * 0.15, this.player.height * 0.1);
        
        // プレイヤーの摩擦を増加させて滑りを減らす
        this.player.body.setFriction(1, 1);
        this.player.body.setDragX(0.5); // 水平方向の抵抗
        
        // カメラをプレイヤーに追従
        this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
        
        console.log('プレイヤーを作成しました:', {
            x: this.player.x,
            y: this.player.y,
            scale: this.player.scale,
            width: this.player.width,
            height: this.player.height
        });
    }

    createAnimations() {
        // 右向きの走るアニメーション
        this.anims.create({
            key: 'run_right',
            frames: [
                { key: 'player_run_right0' },
                { key: 'player_run_right1' },
                { key: 'player_run_right2' }
            ],
            frameRate: 10,
            repeat: -1
        });
        
        // 左向きの走るアニメーション（右向きを反転）
        this.anims.create({
            key: 'run_left',
            frames: [
                { key: 'player_run_right0', flipX: true },
                { key: 'player_run_right1', flipX: true },
                { key: 'player_run_right2', flipX: true }
            ],
            frameRate: 10,
            repeat: -1
        });

        // ハシゴを登るアニメーション（player_climbing.pngを使用）
        this.anims.create({
            key: 'climb',
            frames: [
                { key: 'player_climbing', flipX: false },
                { key: 'player_climbing', flipX: true }
            ],
            frameRate: 4,
            repeat: -1
        });
    }

    // サウンドのオン/オフを切り替える
    toggleSound() {
        this.isSoundOn = !this.isSoundOn;
        console.log(`サウンド状態を切り替えました: ${this.isSoundOn ? 'ON' : 'OFF'}`);
        
        if (this.isSoundOn && this.hasSoundSystem) {
            // サウンドをオンにする
            // ゲーム内ボタンの更新
            this.soundText.setText('♫');
            
            // HTML外部ボタンの更新
            if (this.htmlSoundButton) {
                this.htmlSoundButton.innerHTML = '🔊 サウンド: ON';
                this.htmlSoundButton.style.color = '#00FF00';
                this.htmlSoundButton.style.border = '4px solid #00FF00';
            }
            
            this.sound.mute = false;
            
            // BGMを再生
            if (this.bgm && !this.bgm.isPlaying) {
                try {
                    this.bgm.play();
                    console.log('BGMの再生を開始しました');
                } catch (error) {
                    console.log('BGMの再生に失敗しました:', error);
                }
            }
        } else {
            // サウンドをオフにする
            // ゲーム内ボタンの更新
            this.soundText.setText('×');
            
            // HTML外部ボタンの更新
            if (this.htmlSoundButton) {
                this.htmlSoundButton.innerHTML = '🔊 サウンド: OFF';
                this.htmlSoundButton.style.color = '#FF3333';
                this.htmlSoundButton.style.border = '4px solid #FF3333';
            }
            
            if (this.hasSoundSystem) {
                this.sound.mute = true;
                console.log('サウンドをミュートしました');
                
                // BGMを停止
                if (this.bgm && this.bgm.isPlaying) {
                    try {
                        this.bgm.stop();
                        console.log('BGMを停止しました');
                    } catch (error) {
                        console.log('BGMの停止に失敗しました:', error);
                    }
                }
            }
        }
    }

    // サウンドトグルボタンの作成（ゲーム内のボタン）
    createSoundToggleButton() {
        // ゲーム画面のサイズを取得
        const gameWidth = this.game.config.width;
        const gameHeight = this.game.config.height;
        const zoom = this.cameras.main.zoom;
        
        // ボタンのサイズを設定
        const buttonSize = 60;
        
        // 画面の右上に配置（ズームを考慮）
        const buttonX = (gameWidth / zoom) - buttonSize - 10;
        const buttonY = 10;
        
        console.log(`サウンドボタン作成: x=${buttonX}, y=${buttonY}, サイズ=${buttonSize}, 画面サイズ=${gameWidth}x${gameHeight}, ズーム=${zoom}`);
        
        // 赤いファミコン風のボタンを作成
        this.soundButton = this.add.graphics();
        this.soundButton.fillStyle(0xFF3333, 1);  // 赤い背景（不透明）
        this.soundButton.lineStyle(3, 0xFFFFFF, 1);  // 白い枠線
        this.soundButton.fillRoundedRect(buttonX, buttonY, buttonSize, buttonSize, 10);  // 四角形
        this.soundButton.strokeRoundedRect(buttonX, buttonY, buttonSize, buttonSize, 10);  // 枠線
        this.soundButton.setScrollFactor(0);  // カメラに追従しない
        this.soundButton.setInteractive(new Phaser.Geom.Rectangle(buttonX, buttonY, buttonSize, buttonSize), Phaser.Geom.Rectangle.Contains);
        this.soundButton.setDepth(1000);  // 最前面に表示
        
        // サウンドアイコンのテキスト
        this.soundText = this.add.text(buttonX + buttonSize/2, buttonY + buttonSize/2, '×', {
            fontSize: '32px',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            fill: '#ffffff'
        })
        .setOrigin(0.5)
        .setScrollFactor(0)  // カメラに追従しない
        .setDepth(1001);  // 最前面に表示
        
        // ボタンクリック時の処理
        this.soundButton.on('pointerdown', () => {
            console.log('サウンドボタンがクリックされました');
            
            // クリック時のエフェクト
            this.soundButton.clear();
            this.soundButton.fillStyle(0xFF9999, 1);  // クリック時は薄い赤色
            this.soundButton.lineStyle(3, 0xFFFFFF, 1);
            this.soundButton.fillRoundedRect(buttonX, buttonY, buttonSize, buttonSize, 10);
            this.soundButton.strokeRoundedRect(buttonX, buttonY, buttonSize, buttonSize, 10);
            
            // テキストを少し下に移動させる効果
            this.soundText.y += 2;
            
            // 少し遅延してからサウンド切り替え処理を実行
            this.time.delayedCall(100, () => {
                // ボタンを元の色に戻す
                this.soundButton.clear();
                this.soundButton.fillStyle(0xFF3333, 1);
                this.soundButton.lineStyle(3, 0xFFFFFF, 1);
                this.soundButton.fillRoundedRect(buttonX, buttonY, buttonSize, buttonSize, 10);
                this.soundButton.strokeRoundedRect(buttonX, buttonY, buttonSize, buttonSize, 10);
                
                // テキストを元の位置に戻す
                this.soundText.y -= 2;
                
                // サウンド切り替え処理
                this.toggleSound();
            });
        });
        
        // ボタンのホバーエフェクト
        this.soundButton.on('pointerover', () => {
            // ホバー時はボタンの色を変更
            this.soundButton.clear();
            this.soundButton.fillStyle(0xFF6666, 1);  // ホバー時は少し明るい赤色
            this.soundButton.lineStyle(3, 0xFFFF00, 1);  // 黄色の枠線
            this.soundButton.fillRoundedRect(buttonX, buttonY, buttonSize, buttonSize, 10);
            this.soundButton.strokeRoundedRect(buttonX, buttonY, buttonSize, buttonSize, 10);
            
            // テキストを黄色に
            this.soundText.setTint(0xffff00);
        });
        
        this.soundButton.on('pointerout', () => {
            // ホバーが外れたらボタンの色を元に戻す
            this.soundButton.clear();
            this.soundButton.fillStyle(0xFF3333, 1);  // 元の赤色
            this.soundButton.lineStyle(3, 0xFFFFFF, 1);  // 白い枠線
            this.soundButton.fillRoundedRect(buttonX, buttonY, buttonSize, buttonSize, 10);
            this.soundButton.strokeRoundedRect(buttonX, buttonY, buttonSize, buttonSize, 10);
            
            // テキストの色を元に戻す
            this.soundText.clearTint();
        });
    }

    // サウンドシステムの初期化
    initSoundSystem() {
        this.hasSoundSystem = false;
        this.isSoundOn = false;  // 初期状態はオフ
        
        try {
            // サウンドシステムが利用可能かどうかをチェック
            if (this.sound && this.sound.context) {
                // サウンドを初期化
                try {
                    this.jumpSound = this.sound.add('jump', { volume: 0.5 });
                    console.log('ジャンプ音を初期化しました');
                } catch (error) {
                    console.error('ジャンプ音の初期化に失敗しました:', error);
                }
                
                try {
                    this.bgm = this.sound.add('bgm', { loop: true, volume: 0.5 });
                    console.log('BGMを初期化しました');
                } catch (error) {
                    console.error('BGMの初期化に失敗しました:', error);
                }
                
                if (this.jumpSound || this.bgm) {
                    this.hasSoundSystem = true;
                    console.log('サウンドシステムを初期化しました');
                } else {
                    console.warn('サウンドファイルが正しく初期化されませんでした');
                }
            } else {
                console.warn('サウンドシステムが利用できません');
            }
        } catch (error) {
            console.error('サウンドシステムの初期化に失敗しました:', error);
        }
        
        // サウンドシステムの状態をログに出力
        console.log(`サウンドシステム状態: ${this.hasSoundSystem ? '利用可能' : '利用不可'}`);
        if (this.hasSoundSystem) {
            console.log(`- ジャンプ音: ${this.jumpSound ? '読み込み済み' : '未読み込み'}`);
            console.log(`- BGM: ${this.bgm ? '読み込み済み' : '未読み込み'}`);
        }
    }

    update(time, delta) {
        // プレイヤーが画面外に落ちた場合はリスタート
        if (this.player.y > 240) {  // 画面の高さに合わせて修正
            // BGMを停止してからシーンをリスタート（サウンドシステムが利用可能な場合のみ）
            if (this.hasSoundSystem && this.bgm) {
                try {
                    this.bgm.stop();
                } catch (error) {
                    console.log('BGMの停止に失敗しました:', error);
                }
            }
            this.scene.restart();
            return;
        }

        // ハシゴから離れた時のフラグリセット
        const wasOnLadder = this.isOnLadder;
        this.isOnLadder = false; // 毎フレームリセット（オーバーラップ検出で再設定される）
        
        // 物理的な接地判定
        const physicsTouchingDown = this.player.body.touching.down || this.player.body.blocked.down;
        
        // 接地判定の安定化ロジック
        if (physicsTouchingDown) {
            this.groundedTime += delta;
            this.airborneTime = 0;
        } else {
            this.airborneTime += delta;
            this.groundedTime = 0;
        }
        
        // 視覚表現のための安定した接地判定（短時間の非接地は無視する）
        const visualGrounded = physicsTouchingDown || this.airborneTime < this.groundBufferTime;
        
        // 物理演算用の接地判定（実際の物理状態を優先）
        const isGrounded = physicsTouchingDown;
        
        // 前の状態を保存
        const prevState = this.playerState;
        
        // プレイヤーの状態を判定
        let newState = prevState; // デフォルトは前の状態を維持
        
        // ジャンプの上昇/下降状態を判定
        const isRising = this.player.body.velocity.y < 0;
        const isFalling = this.player.body.velocity.y > 0;
        
        // ハシゴから離れた時の処理
        if (wasOnLadder && !this.isOnLadder) {
            // ハシゴから離れたら重力を有効化
            this.player.body.setAllowGravity(true);
            
            // ハシゴから離れた時、地面に接地していなければジャンプ状態に
            if (!isGrounded) {
                newState = isRising ? 'jumping_up' : 'jumping_down';
            } else {
                newState = 'idle';
            }
        }
        
        // プレイヤーの移動処理（ハシゴ上でなければ通常の移動）
        if (!this.isOnLadder) {
            if (this.cursors.left.isDown) {
                // 左に移動
                this.player.setVelocityX(-160);
                this.playerDirection = 'left';
                
                if (visualGrounded) {
                    if (this.cursors.down.isDown) {
                        newState = 'crouching';
                    } else {
                        newState = 'running';
                    }
                }
            } else if (this.cursors.right.isDown) {
                // 右に移動
                this.player.setVelocityX(160);
                this.playerDirection = 'right';
                
                if (visualGrounded) {
                    if (this.cursors.down.isDown) {
                        newState = 'crouching';
                    } else {
                        newState = 'running';
                    }
                }
            } else {
                // 停止
                this.player.setVelocityX(0);
                
                if (visualGrounded) {
                    if (this.cursors.down.isDown) {
                        newState = 'crouching';
                    } else {
                        newState = 'idle';
                    }
                }
            }
            
            // しゃがみ処理
            if (this.cursors.down.isDown && visualGrounded) {
                this.isCrouching = true;
                newState = 'crouching';
            } else {
                this.isCrouching = false;
            }
            
            // ジャンプ処理の改善
            const canJump = isGrounded && !this.isCrouching && 
                            time - this.lastJumpTime > this.jumpBufferTime;
            
            if (this.cursors.up.isDown && canJump) {
                // プレイヤーの高さは元の画像の高さ×スケール(0.25)
                // 適切なジャンプ力を計算（重力と高さから算出）
                const jumpHeight = this.player.height * 4 / 9; // ジャンプ高さを2倍に増加
                const gravity = this.physics.world.gravity.y;
                // 物理法則に基づいたジャンプ速度の計算: v = sqrt(2 * g * h)
                const jumpVelocity = Math.sqrt(2 * gravity * jumpHeight) * -1;
                
                this.player.setVelocityY(jumpVelocity);
                this.isJumping = true;
                newState = 'jumping_up'; // 上昇中のジャンプ状態
                this.lastJumpTime = time;
                
                // ジャンプ音を再生（サウンドシステムが利用可能かつサウンドがオンの場合のみ）
                this.playJumpSound();
            }
            
            // ジャンプ中の処理
            if (!visualGrounded) {
                // 上昇中か下降中かを判断して異なる状態を設定
                if (isRising) {
                    newState = 'jumping_up';   // 上昇中
                } else if (isFalling) {
                    newState = 'jumping_down'; // 下降中
                }
            } else if (this.isJumping && isGrounded && this.groundedTime > this.groundBufferTime * 2) {
                // 十分な時間接地していたらジャンプフラグをリセット（猶予時間を2倍に）
                this.isJumping = false;
            }
        } else {
            // ハシゴ上では左右移動を制限（X軸の速度をゼロに）
            this.player.setVelocityX(0);
            newState = 'climbing';
        }
        
        // プレイヤーがタイルに詰まるのを防ぐための処理
        if (isGrounded && this.player.body.velocity.y > 0) {
            // 落下中なのに接地判定がある場合は上方向に微調整
            this.player.y -= 0.5;
        }
        
        // 状態が変わった場合のみテクスチャを更新
        if (newState !== prevState) {
            // 状態履歴を更新
            this.stateHistory.unshift(prevState);
            if (this.stateHistory.length > this.stateHistoryMaxLength) {
                this.stateHistory.pop();
            }
            
            // 状態変化が頻繁すぎる場合（短時間で同じ状態を行ったり来たりする場合）は無視
            const isFrequentStateChange = 
                this.lastStateChangeTime && 
                (time - this.lastStateChangeTime < this.stateChangeThreshold);
            
            // 繰り返しパターンを検出（例: idle→jumping→idle→jumping）
            const hasRepeatingPattern = this.detectRepeatingPattern(newState);
            
            if (!isFrequentStateChange && !hasRepeatingPattern) {
                // 状態に応じたテクスチャやアニメーションを設定
                this.updatePlayerAppearance(newState);
                this.playerState = newState;
                this.lastStateChangeTime = time;
            } else {
                // 繰り返しパターンが検出された場合、地面に接地していれば idle 状態を優先
                if (hasRepeatingPattern && visualGrounded && newState === 'idle') {
                    this.updatePlayerAppearance('idle');
                    this.playerState = 'idle';
                    this.lastStateChangeTime = time;
                    this.isJumping = false; // ジャンプフラグをリセット
                    
                    // 状態履歴をリセット
                    this.stateHistory = Array(this.stateHistoryMaxLength).fill('idle');
                }
            }
        } else if (newState === 'jumping_up' || newState === 'jumping_down') {
            // ジャンプ中は常に上昇/下降状態を確認して適切な画像を表示
            const currentJumpState = isRising ? 'jumping_up' : 'jumping_down';
            if (currentJumpState !== newState) {
                this.updatePlayerAppearance(currentJumpState);
                this.playerState = currentJumpState;
            }
        }
        
        // デバッグ：状態をコンソールに出力（フレームレートを下げるため100msごと）
        if (Math.floor(time / 100) !== Math.floor((time - delta) / 100)) {
            // console.log(`位置: (${this.player.x.toFixed(1)}, ${this.player.y.toFixed(1)}), 速度: (${this.player.body.velocity.x.toFixed(1)}, ${this.player.body.velocity.y.toFixed(1)}), 接地: ${isGrounded}`);
        }
    }
    
    // 繰り返しパターンを検出するメソッド
    detectRepeatingPattern(newState) {
        // 履歴が十分に蓄積されていない場合は早期リターン
        if (this.stateHistory.length < 4) return false;
        
        // ジャンプ状態を統一して判定（上昇/下降の区別なく「jumping」として扱う）
        const normalizeState = (state) => {
            if (state === 'jumping_up' || state === 'jumping_down') return 'jumping';
            return state;
        };
        
        const normalizedNewState = normalizeState(newState);
        const normalizedHistory = this.stateHistory.map(normalizeState);
        
        // idle と jumping の繰り返しパターンを検出
        if (normalizedNewState === 'jumping' && normalizedHistory[0] === 'idle' && 
            normalizedHistory[1] === 'jumping' && normalizedHistory[2] === 'idle') {
            return true;
        }
        
        if (normalizedNewState === 'idle' && normalizedHistory[0] === 'jumping' && 
            normalizedHistory[1] === 'idle' && normalizedHistory[2] === 'jumping') {
            return true;
        }
        
        return false;
    }

    // プレイヤーの外見を状態に基づいて更新する新しいメソッド
    updatePlayerAppearance(state) {
        console.log(`プレイヤー状態を変更: ${this.playerState} → ${state}`);
        
        // すでに再生中のアニメーションがあれば、同じアニメーションの場合は何もしない
        if (this.player.anims.isPlaying) {
            if ((state === 'running' && 
                 ((this.playerDirection === 'right' && this.player.anims.currentAnim.key === 'run_right') ||
                  (this.playerDirection === 'left' && this.player.anims.currentAnim.key === 'run_left'))) ||
                (state === 'climbing' && this.player.anims.currentAnim.key === 'climb')) {
                // 同じアニメーションが再生中なら何もしない
                return;
            }
        }
        
        // テクスチャが既に同じなら何もしない（ジャンプの上昇/下降は除く）
        if (state === 'idle' && this.player.texture.key === 'player_idle_right' && 
            this.player.flipX === (this.playerDirection === 'left')) {
            return;
        }
        
        if (state === 'jumping_up' && this.player.texture.key === 'player_jump_right1' && 
            this.player.flipX === (this.playerDirection === 'left')) {
            return;
        }
        
        if (state === 'jumping_down' && this.player.texture.key === 'player_jump_right0' && 
            this.player.flipX === (this.playerDirection === 'left')) {
            return;
        }
        
        if (state === 'crouching' && this.player.texture.key === 'player_crouch') {
            return;
        }
        
        if (state === 'climbing' && this.player.texture.key === 'player_climbing') {
            return;
        }
        
        // アニメーションを停止
        this.player.anims.stop();
        
        switch (state) {
            case 'idle':
                this.player.setTexture('player_idle_right');
                this.player.setFlipX(this.playerDirection === 'left');
                break;
                
            case 'running':
                if (this.playerDirection === 'right') {
                    this.player.anims.play('run_right', true);
                    this.player.setFlipX(false);
                } else {
                    this.player.anims.play('run_left', true);
                    this.player.setFlipX(true);
                }
                break;
                
            case 'jumping_up':
                // 上昇中は player_jump_right1.png を使用
                this.player.setTexture('player_jump_right1');
                this.player.setFlipX(this.playerDirection === 'left');
                break;
                
            case 'jumping_down':
                // 下降中は player_jump_right0.png を使用
                this.player.setTexture('player_jump_right0');
                this.player.setFlipX(this.playerDirection === 'left');
                break;
                
            case 'crouching':
                this.player.setTexture('player_crouch');
                break;
                
            case 'climbing':
                this.player.anims.play('climb', true);
                break;
        }
    }

    // ジャンプ音を再生
    playJumpSound() {
        if (this.hasSoundSystem && this.jumpSound && this.isSoundOn) {
            try {
                // 既に再生中の場合は停止してから再生
                if (this.jumpSound.isPlaying) {
                    this.jumpSound.stop();
                }
                
                this.jumpSound.play();
                console.log('ジャンプ効果音を再生しました');
            } catch (error) {
                console.error('ジャンプ音の再生に失敗しました:', error);
                
                // エラーが発生した場合、サウンドを再作成してみる
                try {
                    this.jumpSound = this.sound.add('jump', { volume: 0.5 });
                    this.jumpSound.play();
                    console.log('ジャンプ音を再作成して再生しました');
                } catch (retryError) {
                    console.error('ジャンプ音の再作成と再生に失敗しました:', retryError);
                }
            }
        } else {
            if (!this.hasSoundSystem) {
                console.warn('サウンドシステムが利用できないためジャンプ音を再生できません');
            } else if (!this.jumpSound) {
                console.warn('ジャンプ音が初期化されていないため再生できません');
            } else if (!this.isSoundOn) {
                console.log('サウンドがオフのためジャンプ音を再生しません');
            }
        }
    }
}

export default GameScene;


