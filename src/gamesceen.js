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
        this.groundData = [];
        this.waterTiles = [];
        this.pitAreas = [[6, 7], [12, 13], [18, 20]];
        this.playerStartPosition = { x: 83, y: 120.125 };
    }

    preload() {
        // プレイヤー画像のロード
        this.load.image('player_idle_right', 'src/assets/player_idle_right.png');
        this.load.image('player_crouch', 'src/assets/player_crouch.png');
        this.load.image('player_jump_right', 'src/assets/player_jump_right0.png');
        this.load.image('player_climbing', 'src/assets/player_climing.png');
        
        // 走るアニメーション用の画像をロード
        for (let i = 0; i < 3; i++) {
            this.load.image(`player_run_right${i}`, `src/assets/player_run_right${i}.png`);
        }
        
        // 地面とその他のゲーム要素
        this.load.image('ground', 'src/assets/ground.png');
        this.load.image('water', 'src/assets/water.png');
        this.load.image('stage', 'src/assets/stage.png');
    }

    create() {
        // 物理世界の境界を設定
        this.physics.world.setBounds(0, 0, 1200, 240);
        
        // 重力を設定
        this.physics.world.gravity.y = 500;
        
        // ステージ背景を追加（表示サイズは変更しない）
        this.add.image(0, 0, 'stage')
            .setOrigin(0, 0);
        
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
        
        // コライダーの作成
        this.createColliders();
        
        // プレイヤーの作成
        this.createPlayer();
        
        // アニメーションの作成
        this.createAnimations();
        
        // キーボード入力の設定
        this.cursors = this.input.keyboard.createCursorKeys();
        
        // プレイヤーと地面の衝突を設定
        this.physics.add.collider(this.player, this.platforms);
        
        // プレイヤーとハシゴのオーバーラップを設定
        this.physics.add.overlap(this.player, this.ladders, this.handleLadderOverlap, null, this);
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
        this.scene.restart();
    }

    // ハシゴとの接触処理
    handleLadderOverlap(player, ladder) {
        this.isOnLadder = true;
        if (this.cursors.up.isDown) {
            player.setVelocityY(-100);
            player.anims.play('climb', true);
        } else if (this.cursors.down.isDown) {
            player.setVelocityY(100);
            player.anims.play('climb', true);
        } else {
            player.setVelocityY(0);
            player.anims.stop();
        }
    }

    generateGroundData() {
        // 画面幅に基づいて地面データを生成
        const screenWidth = this.sys.game.config.width;
        const tileWidth = 32; // タイルの幅
        const numTiles = Math.ceil(screenWidth / tileWidth) + 10; // 画面外も含めて生成
        
        // 基本の高さ（画面下部）
        const baseHeight = 500;
        
        for (let i = 0; i < numTiles; i++) {
            // ピットエリアかどうかをチェック
            let isPit = false;
            for (const pitArea of this.pitAreas) {
                if (i >= pitArea[0] && i <= pitArea[1]) {
                    isPit = true;
                    break;
                }
            }
            
            if (!isPit) {
                // 丘や谷を作るためのランダムな高さの変動
                let heightVariation = 0;
                if (i > 0) {
                    // 前のタイルとの高さの差を小さくして滑らかにする
                    const prevHeight = this.groundData.length > 0 ? this.groundData[this.groundData.length - 1].y : baseHeight;
                    heightVariation = Math.random() * 10 - 5; // -5から5の範囲
                    const newHeight = Math.max(baseHeight - 20, Math.min(baseHeight + 20, prevHeight + heightVariation));
                    this.groundData.push({ x: i * tileWidth, y: newHeight, width: tileWidth, height: 600 - newHeight });
                } else {
                    this.groundData.push({ x: i * tileWidth, y: baseHeight, width: tileWidth, height: 600 - baseHeight });
                }
            } else {
                // ピットエリアには水を配置
                this.waterTiles.push({ x: i * tileWidth, y: 550, width: tileWidth, height: 50 });
            }
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
        }
        
        // 水タイルの作成
        for (const water of this.waterTiles) {
            this.add.image(water.x, water.y, 'water')
                .setOrigin(0, 0)
                .setDisplaySize(water.width, water.height);
        }
    }

    createPlayer() {
        // プレイヤーの作成
        this.player = this.physics.add.sprite(this.playerStartPosition.x, this.playerStartPosition.y, 'player_idle_right');
        this.player.setScale(0.25);
        this.player.setBounce(0.1);
        this.player.setCollideWorldBounds(true);
        
        // プレイヤーの当たり判定を調整
        this.player.body.setSize(this.player.width * 0.7, this.player.height * 0.9);
        this.player.body.setOffset(this.player.width * 0.15, this.player.height * 0.1);

        // カメラをプレイヤーに追従
        this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
        this.cameras.main.setFollowOffset(-this.scale.width / 4, 0);  // プレイヤーを画面の左よりに表示
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

        // ハシゴを登るアニメーション
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

    update() {
        // プレイヤーが画面外に落ちた場合はリスタート
        if (this.player.y > 240) {  // 画面の高さに合わせて修正
            this.scene.restart();
            return;
        }

        // ハシゴから離れた時のフラグリセット
        if (!this.isOnLadder) {
            this.player.body.setAllowGravity(true);
        }
        this.isOnLadder = false;
        
        // プレイヤーの移動処理
        if (this.cursors.left.isDown) {
            // 左に移動
            this.player.setVelocityX(-160);
            this.playerDirection = 'left';
            
            if (this.player.body.touching.down && !this.isOnLadder) {
                if (this.isCrouching) {
                    this.player.setTexture('player_crouch');
                } else {
                    this.player.anims.play('run_left', true);
                }
            }
        } else if (this.cursors.right.isDown) {
            // 右に移動
            this.player.setVelocityX(160);
            this.playerDirection = 'right';
            
            if (this.player.body.touching.down && !this.isOnLadder) {
                if (this.isCrouching) {
                    this.player.setTexture('player_crouch');
                } else {
                    this.player.anims.play('run_right', true);
                }
            }
        } else {
            // 停止
            this.player.setVelocityX(0);
            
            if (this.player.body.touching.down && !this.isOnLadder) {
                if (this.isCrouching) {
                    this.player.setTexture('player_crouch');
                } else {
                    this.player.setTexture('player_idle_right');
                    this.player.setFlipX(this.playerDirection === 'left');
                }
            }
        }
        
        // しゃがみ処理（ハシゴ上では無効）
        if (this.cursors.down.isDown && this.player.body.touching.down && !this.isOnLadder) {
            this.isCrouching = true;
            this.player.setTexture('player_crouch');
        } else {
            this.isCrouching = false;
        }
        
        // ジャンプ処理（ハシゴ上では無効）
        if (this.cursors.up.isDown && this.player.body.touching.down && !this.isCrouching && !this.isOnLadder) {
            this.player.setVelocityY(-330);
            this.isJumping = true;
        }
        
        // ジャンプ中の処理（ハシゴ上では無効）
        if (!this.player.body.touching.down && !this.isOnLadder) {
            this.player.setTexture('player_jump_right');
            this.player.setFlipX(this.playerDirection === 'left');
        } else {
            this.isJumping = false;
        }
    }
}

export default GameScene;
