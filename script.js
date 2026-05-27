// 今天吃什么 - 转盘逻辑

class FoodWheel {
    constructor() {
        this.foods = [];
        this.stats = {}; // 统计数据 { foodName: count }
        this.isSpinning = false;
        this.rotation = 0;
        
        // DOM元素
        this.canvas = document.getElementById('wheelCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.input = document.getElementById('foodInput');
        this.addBtn = document.getElementById('addBtn');
        this.spinBtn = document.getElementById('spinBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.foodTags = document.getElementById('foodTags');
        this.statsSection = document.getElementById('statsSection');
        this.statsList = document.getElementById('statsList');
        this.clearStatsBtn = document.getElementById('clearStatsBtn');
        this.randomFillBtn = document.getElementById('randomFillBtn');
        
        // 莫兰迪配色方案
        this.colors = [
            '#8FAE8B',  // 豆沙绿
            '#6B8CAE',  // 雾霾蓝
            '#C4A4A0',  // 灰豆粉
            '#D4A574',  // 暖焦糖
            '#A8B5A2',  // 灰绿
            '#B8A9C9',  // 薰衣草
            '#C9B8A8',  // 浅驼色
            '#8CAAB8',  // 灰蓝
        ];
        
        // 检查 crypto API 支持
        this.useCrypto = typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function';
        
        // 初始化音频上下文
        this.initAudio();
        
        this.init();
        this.loadFromStorage();
    }
    
    // 初始化音频系统
    initAudio() {
        this.audioCtx = null;
        this.tickSoundInterval = null;
        
        // 用户交互后才能创建AudioContext
        const initContext = () => {
            if (!this.audioCtx) {
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            document.removeEventListener('click', initContext);
            document.removeEventListener('touchstart', initContext);
        };
        
        document.addEventListener('click', initContext);
        document.addEventListener('touchstart', initContext);
    }
    
    // 播放点击音效
    playClickSound() {
        if (!this.audioCtx) return;
        
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        
        osc.frequency.value = 800;
        osc.type = 'sine';
        
        gain.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.1);
        
        osc.start(this.audioCtx.currentTime);
        osc.stop(this.audioCtx.currentTime + 0.1);
    }
    
    // 播放旋转音效（连续滴答声）
    startTickSound() {
        if (!this.audioCtx) return;
        
        let tickCount = 0;
        const maxTicks = 40;
        
        const playTick = () => {
            if (tickCount >= maxTicks || !this.isSpinning) {
                this.stopTickSound();
                return;
            }
            
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            
            // 音调逐渐降低
            osc.frequency.value = 600 - (tickCount * 8);
            osc.type = 'sine';
            
            gain.gain.setValueAtTime(0.08, this.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.05);
            
            osc.start(this.audioCtx.currentTime);
            osc.stop(this.audioCtx.currentTime + 0.05);
            
            tickCount++;
        };
        
        this.tickSoundInterval = setInterval(playTick, 80);
    }
    
    // 停止旋转音效
    stopTickSound() {
        if (this.tickSoundInterval) {
            clearInterval(this.tickSoundInterval);
            this.tickSoundInterval = null;
        }
    }
    
    // 播放结果揭晓音效
    playResultSound() {
        if (!this.audioCtx) return;
        
        const notes = [523, 659, 784]; // C5, E5, G5
        let delay = 0;
        
        notes.forEach((freq, i) => {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            
            osc.frequency.value = freq;
            osc.type = 'sine';
            
            const startTime = this.audioCtx.currentTime + delay;
            gain.gain.setValueAtTime(0.15, startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);
            
            osc.start(startTime);
            osc.stop(startTime + 0.3);
            
            delay += 0.12;
        });
    }
    
    init() {
        // 初始化高DPI Canvas
        this.setupHighDPI();
        
        // 绑定事件
        this.addBtn.addEventListener('click', () => {
            this.playClickSound();
            this.addFood();
        });
        this.input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.playClickSound();
                this.addFood();
            }
        });
        this.spinBtn.addEventListener('click', () => this.spin());
        this.clearBtn.addEventListener('click', () => {
            this.playClickSound();
            this.clearAll();
        });
        this.clearStatsBtn.addEventListener('click', () => {
            this.playClickSound();
            this.clearStats();
        });
        this.randomFillBtn.addEventListener('click', () => {
            this.playClickSound();
            this.randomFill();
        });
        
        // 监听窗口大小变化
        window.addEventListener('resize', () => {
            this.setupHighDPI();
            this.drawWheel();
        });
        
        // 移动端优化
        this.setupMobileOptimizations();
        
        // 初始绘制
        this.drawWheel();
    }
    
    // 移动端优化
    setupMobileOptimizations() {
        // 检测是否为移动设备
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (this.isMobile) {
            // 防止双击缩放
            let lastTouchEnd = 0;
            document.addEventListener('touchend', (e) => {
                const now = Date.now();
                if (now - lastTouchEnd <= 300) {
                    e.preventDefault();
                }
                lastTouchEnd = now;
            }, false);
            
            // 为按钮添加触摸反馈
            const buttons = document.querySelectorAll('button');
            buttons.forEach(btn => {
                btn.addEventListener('touchstart', () => {
                    btn.style.transform = 'scale(0.96)';
                }, { passive: true });
                btn.addEventListener('touchend', () => {
                    btn.style.transform = '';
                }, { passive: true });
            });
        }
    }
    
    // 设置高DPI Canvas
    setupHighDPI() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        
        // 获取显示尺寸，如果返回0则使用默认值
        let width = rect.width;
        let height = rect.height;
        
        // 如果尺寸为0，使用CSS样式中的尺寸
        if (width === 0 || height === 0) {
            const style = window.getComputedStyle(this.canvas);
            width = parseInt(style.width) || 320;
            height = parseInt(style.height) || 320;
        }
        
        // 设置实际像素大小（高分辨率）
        this.canvas.width = width * dpr;
        this.canvas.height = height * dpr;
        
        // 缩放绘图上下文以匹配CSS尺寸
        this.ctx.scale(dpr, dpr);
        
        // 保存显示尺寸用于绘图
        this.displayWidth = width;
        this.displayHeight = height;
        
        console.log('Canvas尺寸:', width, height, 'DPR:', dpr);
    }
    
    // 随机填充
    randomFill() {
        if (this.foods.length >= 10) {
            this.showToast('已经有10个选项了');
            return;
        }
        
        const allFoods = [
            '炒饭', '面条', '麻辣烫', '汉堡', '披萨',
            '寿司', '烧烤', '火锅', '饺子', '炸鸡',
            '盖饭', '拉面', '炒面', '米线', '汉堡',
            '三明治', '沙拉', '牛排', '意面', '烤肉'
        ];
        
        // 过滤掉已存在的食物
        const existingNames = this.foods.map(f => f.name);
        const available = allFoods.filter(f => !existingNames.includes(f));
        
        // 随机选择，最多填到10个
        const remaining = 10 - this.foods.length;
        const count = Math.min(remaining, 8); // 一次填充8个
        
        // 随机打乱并取前count个
        const shuffled = available.sort(() => this.secureRandom() - 0.5);
        const selected = shuffled.slice(0, count);
        
        // 添加到列表
        selected.forEach(name => {
            this.foods.push({
                name: name,
                color: this.colors[this.foods.length % this.colors.length]
            });
        });
        
        this.updateUI();
        this.saveToStorage();
        this.showToast(`已添加${selected.length}个选项`);
    }
    
    // 添加食物
    addFood() {
        const name = this.input.value.trim();
        if (!name) return;
        
        if (this.foods.length >= 10) {
            this.showToast('最多添加10个选项');
            return;
        }
        
        if (this.foods.some(f => f.name === name)) {
            this.showToast('已经存在了');
            return;
        }
        
        this.foods.push({
            name: name,
            color: this.colors[this.foods.length % this.colors.length]
        });
        
        this.input.value = '';
        this.updateUI();
        this.saveToStorage();
    }
    
    // 删除食物
    removeFood(index) {
        this.foods.splice(index, 1);
        this.updateUI();
        this.saveToStorage();
    }
    
    // 清空所有
    clearAll() {
        if (this.foods.length === 0) return;
        this.foods = [];
        this.updateUI();
        this.saveToStorage();
    }
    
    // 更新UI
    updateUI() {
        this.renderTags();
        this.drawWheel();
        this.spinBtn.disabled = this.foods.length < 2;
    }
    
    // 渲染标签
    renderTags() {
        this.foodTags.innerHTML = this.foods.map((food, index) => `
            <div class="food-tag">
                <span>${food.name}</span>
                <span class="remove" data-index="${index}">×</span>
            </div>
        `).join('');
        
        // 绑定删除事件
        this.foodTags.querySelectorAll('.remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.playClickSound();
                this.removeFood(index);
            });
        });
    }
    
    // 绘制转盘
    drawWheel() {
        const ctx = this.ctx;
        const centerX = this.displayWidth / 2;
        const centerY = this.displayHeight / 2;
        const radius = Math.min(centerX, centerY) - 10;
        
        // 清空画布
        ctx.clearRect(0, 0, this.displayWidth, this.displayHeight);
        
        if (this.foods.length === 0) {
            // 空状态
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.fillStyle = '#F5F5F3';
            ctx.fill();
            ctx.strokeStyle = '#E5E5E3';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            ctx.fillStyle = '#AEAEB2';
            ctx.font = '14px -apple-system, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('添加食物开始', centerX, centerY);
            return;
        }
        
        const sliceAngle = (Math.PI * 2) / this.foods.length;
        
        // 绘制扇形
        this.foods.forEach((food, index) => {
            const startAngle = this.rotation + index * sliceAngle - Math.PI / 2;
            const endAngle = startAngle + sliceAngle;
            
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.closePath();
            ctx.fillStyle = food.color;
            ctx.fill();
            
            // 绘制分割线
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // 绘制文字
            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(startAngle + sliceAngle / 2);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '600 14px -apple-system, sans-serif';
            
            // 文字位置
            const textRadius = radius * 0.65;
            ctx.fillText(food.name, textRadius, 0);
            ctx.restore();
        });
        
        // 绘制中心圆
        ctx.beginPath();
        ctx.arc(centerX, centerY, 24, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
        
        // 绘制外圈
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }
    
    // 密码学安全的随机数生成 (0-1)
    secureRandom() {
        if (this.useCrypto) {
            const array = new Uint32Array(1);
            crypto.getRandomValues(array);
            return array[0] / (0xFFFFFFFF + 1);
        }
        // 降级到 Math.random()
        return Math.random();
    }
    
    // 旋转
    spin() {
        if (this.isSpinning || this.foods.length < 2) return;
        
        this.isSpinning = true;
        this.spinBtn.disabled = true;
        this.spinBtn.textContent = '旋转中...';
        
        // 播放点击音效
        this.playClickSound();
        
        // 开始旋转音效
        setTimeout(() => this.startTickSound(), 200);
        
        // 真随机：生成 0-2π 的任意角度
        const randomAngle = this.secureRandom() * Math.PI * 2;
        
        // 加上5-8整圈，让转盘多转几圈
        const extraSpins = (5 + Math.floor(this.secureRandom() * 4)) * Math.PI * 2;
        
        // 最终目标角度 = 当前位置 + 整圈 + 随机角度
        const targetAngle = this.rotation + extraSpins + randomAngle;
        
        // 随机动画时长
        const duration = 3000 + this.secureRandom() * 1000;
        
        const startRotation = this.rotation;
        const startTime = performance.now();
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // 缓动函数 (先快后慢)
            const easeOut = 1 - Math.pow(1 - progress, 3);
            
            this.rotation = startRotation + (targetAngle - startRotation) * easeOut;
            this.drawWheel();
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.onSpinComplete();
            }
        };
        
        requestAnimationFrame(animate);
    }
    
    // 旋转完成
    onSpinComplete() {
        this.isSpinning = false;
        this.spinBtn.disabled = false;
        this.spinBtn.textContent = '开始旋转';
        
        // 重新绘制转盘
        this.drawWheel();
        
        // 停止旋转音效
        this.stopTickSound();
        
        // 播放结果音效
        this.playResultSound();
        
        // 根据最终角度计算指向哪个扇区
        const sliceAngle = (Math.PI * 2) / this.foods.length;
        // 归一化角度到 0-2π
        const normalizedAngle = ((this.rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        // 指针在顶部(0度)，转盘顺时针旋转，需要反转计算
        const pointerAngle = (Math.PI * 2 - normalizedAngle) % (Math.PI * 2);
        // 计算索引
        const index = Math.floor(pointerAngle / sliceAngle) % this.foods.length;
        
        this.showResult(this.foods[index].name);
    }
    
    // 显示结果（只记录统计和播放音效）
    showResult(foodName) {
        // 记录统计
        this.recordStats(foodName);
    }
    
    // 记录统计数据
    recordStats(foodName) {
        if (this.stats[foodName]) {
            this.stats[foodName]++;
        } else {
            this.stats[foodName] = 1;
        }
        this.saveStats();
        this.renderStats();
    }
    
    // 渲染统计列表
    renderStats() {
        const statsEntries = Object.entries(this.stats);
        
        if (statsEntries.length === 0) {
            this.statsSection.classList.add('hidden');
            return;
        }
        
        this.statsSection.classList.remove('hidden');
        
        // 按次数排序（降序）
        statsEntries.sort((a, b) => b[1] - a[1]);
        
        const maxCount = statsEntries[0][1];
        
        this.statsList.innerHTML = statsEntries.map(([name, count]) => {
            const percentage = (count / maxCount) * 100;
            return `
                <div class="stats-item">
                    <div class="stats-info">
                        <span class="stats-emoji">🍴</span>
                        <span class="stats-name">${name}</span>
                    </div>
                    <div class="stats-bar-wrapper">
                        <div class="stats-bar" style="width: ${percentage}%"></div>
                    </div>
                    <span class="stats-count">${count}次</span>
                </div>
            `;
        }).join('');
    }
    
    // 保存统计数据
    saveStats() {
        localStorage.setItem('food-wheel-stats', JSON.stringify(this.stats));
    }
    
    // 加载统计数据
    loadStats() {
        const saved = localStorage.getItem('food-wheel-stats');
        if (saved) {
            try {
                this.stats = JSON.parse(saved);
                this.renderStats();
            } catch (e) {
                console.error('Failed to load stats:', e);
            }
        }
    }
    
    // 清除统计数据
    clearStats() {
        this.stats = {};
        this.saveStats();
        this.renderStats();
    }
    
    // 显示提示
    showToast(message) {
        // 简单的提示实现
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 100px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(44, 44, 46, 0.9);
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 14px;
            z-index: 200;
            animation: fadeInUp 300ms ease;
        `;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'fadeOutDown 300ms ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }
    
    // 保存到本地存储
    saveToStorage() {
        localStorage.setItem('food-wheel', JSON.stringify(this.foods));
    }
    
    // 从本地存储加载
    loadFromStorage() {
        const saved = localStorage.getItem('food-wheel');
        if (saved) {
            try {
                this.foods = JSON.parse(saved);
                this.updateUI();
            } catch (e) {
                console.error('Failed to load from storage:', e);
            }
        }
        // 加载统计数据
        this.loadStats();
    }
}

// 添加动画样式
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeInUp {
        from {
            opacity: 0;
            transform: translateX(-50%) translateY(10px);
        }
        to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
    }
    
    @keyframes fadeOutDown {
        from {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
        to {
            opacity: 0;
            transform: translateX(-50%) translateY(10px);
        }
    }
`;
document.head.appendChild(style);

// 初始化
const wheel = new FoodWheel();