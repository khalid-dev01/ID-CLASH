import { db } from './firebase-config.js';
import { doc, setDoc, getDoc, updateDoc, arrayUnion, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const POWERUPS_LIST = [
    { id: 'double', name: 'ضربة مزدوجة', icon: 'fa-bolt' },
    { id: 'freeze', name: 'تجميد الزمن', icon: 'fa-snowflake' },
    { id: 'letter', name: 'تسريب الحرف', icon: 'fa-font' },
    { id: 'shield', name: 'درع الفيتو', icon: 'fa-shield-halved' },
    { id: 'steal', name: 'قرصنة', icon: 'fa-user-ninja' },
    { id: 'category', name: 'كشف الفئة', icon: 'fa-eye' }
];

class IDClashGame {
    constructor() {
        this.cacheDOM();
        this.bindEvents();
        this.setupSearchLogic();
        
        this.currentRoomCode = null;
        this.playerName = null;
        this.isHost = false;
        this.unsubscribe = null;
        
        this.searchTimeout = null;
        this.selectedCharacter = null;
        this.localTimerInterval = null;
        this.roomDataCache = null;
    }

    cacheDOM() {
        this.views = {
            lobby: document.getElementById('lobbyView'),
            join: document.getElementById('joinView'),
            room: document.getElementById('roomLobbyView'),
            identity: document.getElementById('identitySelectionView'),
            game: document.getElementById('gameBoardView'),
            gameOver: document.getElementById('gameOverView')
        };
        
        this.buttons = {
            createRoom: document.getElementById('btnCreateRoom'),
            openJoin: document.getElementById('btnOpenJoin'),
            backToLobby: document.getElementById('btnBackToLobby'),
            joinRoom: document.getElementById('btnJoinRoom'),
            startPrep: document.getElementById('btnStartPrep'),
            lockIdentity: document.getElementById('btnLockIdentity'),
            sendQuestion: document.getElementById('btnSendQuestion'),
            ansYes: document.getElementById('btnAnsYes'),
            ansNo: document.getElementById('btnAnsNo'),
            ansDontKnow: document.getElementById('btnAnsDontKnow'),
            openGuessModal: document.getElementById('btnOpenGuessModal'),
            closeGuessModal: document.getElementById('btnCloseGuessModal')
        };
        
        this.inputs = {
            playerName: document.getElementById('playerName'),
            roomCode: document.getElementById('roomCodeInput'),
            search: document.getElementById('searchInput'),
            question: document.getElementById('questionInput'),
            guessSearch: document.getElementById('guessSearchInput')
        };
        
        this.displays = {
            roomCode: document.getElementById('displayRoomCode'),
            playersList: document.getElementById('playersList'),
            playerCount: document.getElementById('playerCount'),
            searchResults: document.getElementById('searchResults'),
            previewContainer: document.getElementById('selectedIdentityPreview'),
            previewImage: document.getElementById('previewImage'),
            previewName: document.getElementById('previewName'),
            waitingLockMsg: document.getElementById('waitingLockMsg'),
            roundTimer: document.getElementById('roundTimerDisplay'),
            turnTimer: document.getElementById('turnTimerDisplay'),
            turnIndicator: document.getElementById('turnIndicator'),
            myQuestionsCount: document.getElementById('myQuestionsCount'),
            myGuessesLeft: document.getElementById('myGuessesLeft'),
            dontKnowCountDisplay: document.getElementById('dontKnowCountDisplay'),
            gameLogBox: document.getElementById('gameLogBox'),
            pendingQuestionArea: document.getElementById('pendingQuestionArea'),
            waitingAnswerArea: document.getElementById('waitingAnswerArea'),
            pendingQuestionText: document.getElementById('pendingQuestionText'),
            activeTurnArea: document.getElementById('activeTurnArea'),
            powerupsContainer: document.getElementById('powerupsContainer'),
            guessModal: document.getElementById('guessModal'),
            guessSearchResults: document.getElementById('guessSearchResults'),
            gameOverTitle: document.getElementById('gameOverTitle'),
            gameOverSub: document.getElementById('gameOverSub'),
            revealedIdentitiesBox: document.getElementById('revealedIdentitiesBox')
        };
    }

    bindEvents() {
        this.buttons.openJoin.addEventListener('click', () => { if (this.validateName()) this.switchView(this.views.join); });
        this.buttons.backToLobby.addEventListener('click', () => this.switchView(this.views.lobby));
        this.buttons.createRoom.addEventListener('click', () => this.handleCreateRoom());
        this.buttons.joinRoom.addEventListener('click', () => this.handleJoinRoom());
        this.buttons.startPrep.addEventListener('click', () => this.handleStartPrepPhase());
        
        this.buttons.sendQuestion.addEventListener('click', () => this.handleSendQuestion());
        this.buttons.ansYes.addEventListener('click', () => this.handleAnswerQuestion('نعم'));
        this.buttons.ansNo.addEventListener('click', () => this.handleAnswerQuestion('لا'));
        this.buttons.ansDontKnow.addEventListener('click', () => this.handleAnswerQuestion('لا أعرف'));

        this.buttons.openGuessModal.addEventListener('click', () => this.displays.guessModal.style.display = 'flex');
        this.buttons.closeGuessModal.addEventListener('click', () => this.displays.guessModal.style.display = 'none');

        document.querySelectorAll('.btnLeaveRoom').forEach(btn => {
            btn.addEventListener('click', () => window.location.reload());
        });
    }

    switchView(activeView) {
        Object.values(this.views).forEach(view => view.classList.remove('active'));
        activeView.classList.add('active');
    }

    validateName() {
        const name = this.inputs.playerName.value.trim();
        if (!name) { alert("أكتب اسمك أول!"); return false; }
        this.playerName = name;
        return name;
    }

    generateRoomCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    }

    async handleCreateRoom() {
        if (!this.validateName()) return;
        this.setBtn(this.buttons.createRoom, true, 'جاري الإنشاء...');
        this.currentRoomCode = this.generateRoomCode();
        this.isHost = true;

        try {
            await setDoc(doc(db, "rooms", this.currentRoomCode), {
                code: this.currentRoomCode, status: 'waiting', createdAt: new Date(),
                players: [{ name: this.playerName, isHost: true, identityLocked: false, character: null, dontKnowCount: 0, guessesLeft: 3, questionsAsked: 0, powerups: [] }]
            });
            this.setupRoomUI();
        } catch (error) { console.error(error); alert("خطأ في الإنشاء."); } 
        finally { this.setBtn(this.buttons.createRoom, false, '<i class="fa-solid fa-plus-circle"></i> إنشاء غرفة جديدة'); }
    }

    async handleJoinRoom() {
        if (!this.validateName()) return;
        const code = this.inputs.roomCode.value.trim().toUpperCase();
        if (!code) { alert("أدخل الكود!"); return; }

        this.setBtn(this.buttons.joinRoom, true, 'جاري الدخول...');
        this.isHost = false;

        try {
            const roomRef = doc(db, "rooms", code);
            const roomSnap = await getDoc(roomRef);

            if (roomSnap.exists()) {
                const data = roomSnap.data();
                if (data.status !== 'waiting') { alert("لا يمكن الدخول، اللعبة جارية."); return; }
                if (data.players.length >= 2) { alert("الغرفة ممتلئة."); return; }
                
                await updateDoc(roomRef, { 
                    players: arrayUnion({ name: this.playerName, isHost: false, identityLocked: false, character: null, dontKnowCount: 0, guessesLeft: 3, questionsAsked: 0, powerups: [] }) 
                });
                this.currentRoomCode = code;
                this.setupRoomUI();
            } else { alert("الكود غير صحيح."); }
        } catch (error) { console.error(error); alert("خطأ في الاتصال."); } 
        finally { this.setBtn(this.buttons.joinRoom, false, '<i class="fa-solid fa-gamepad"></i> انضمام الآن'); }
    }

    setupRoomUI() {
        this.displays.roomCode.innerText = this.currentRoomCode;
        this.buttons.startPrep.style.display = this.isHost ? 'flex' : 'none';
        this.switchView(this.views.room);
        this.listenToRoom();
    }

    async handleStartPrepPhase() {
        if (!this.isHost) return;
        try { await updateDoc(doc(db, "rooms", this.currentRoomCode), { status: 'prep' }); } 
        catch (error) { console.error(error); alert("خطأ."); }
    }

    setupSearchLogic() {
        this.inputs.search.addEventListener('input', (e) => {
            clearTimeout(this.searchTimeout);
            const query = e.target.value.trim();
            if (query.length < 3) { this.displays.searchResults.innerHTML = ''; return; }
            this.displays.searchResults.innerHTML = '<li style="padding: 10px; text-align: center;"><i class="fa-solid fa-spinner fa-spin"></i> جاري البحث...</li>';
            this.searchTimeout = setTimeout(() => this.searchCharactersAPI(query, this.displays.searchResults, (char) => this.selectCharacter(char)), 500);
        });

        this.inputs.guessSearch.addEventListener('input', (e) => {
            clearTimeout(this.searchTimeout);
            const query = e.target.value.trim();
            if (query.length < 3) { this.displays.guessSearchResults.innerHTML = ''; return; }
            this.displays.guessSearchResults.innerHTML = '<li style="padding: 10px; text-align: center;"><i class="fa-solid fa-spinner fa-spin"></i> جاري البحث...</li>';
            this.searchTimeout = setTimeout(() => this.searchCharactersAPI(query, this.displays.guessSearchResults, (char) => this.handleMakeGuess(char)), 500);
        });

        this.buttons.lockIdentity.addEventListener('click', () => this.handleLockIdentity());
    }

    async searchCharactersAPI(query, container, callback) {
        try {
            const response = await fetch(`https://api.jikan.moe/v4/characters?q=${query}&limit=5`);
            const data = await response.json();
            this.renderSearchResults(data.data, container, callback);
        } catch (error) { console.error(error); container.innerHTML = '<li style="padding: 10px; color: #ff2a6d;">فشل البحث.</li>'; }
    }

    renderSearchResults(characters, container, callback) {
        container.innerHTML = '';
        if (!characters || characters.length === 0) { container.innerHTML = '<li style="padding: 10px;">لا توجد نتائج.</li>'; return; }

        characters.forEach(char => {
            const li = document.createElement('li');
            li.className = 'search-result-item';
            const imageUrl = char.images?.jpg?.image_url || 'https://via.placeholder.com/40x40?text=?';
            li.innerHTML = `<img src="${imageUrl}"> <div class="search-result-info"><h4>${char.name}</h4></div>`;
            li.addEventListener('click', () => callback({ name: char.name, imageUrl }));
            container.appendChild(li);
        });
    }

    selectCharacter(char) {
        this.selectedCharacter = char;
        this.displays.searchResults.innerHTML = '';
        this.inputs.search.value = '';
        this.displays.previewImage.src = char.imageUrl;
        this.displays.previewName.innerText = char.name;
        this.displays.previewContainer.style.display = 'block';
        this.buttons.lockIdentity.disabled = false;
    }

    async handleLockIdentity() {
        if (!this.selectedCharacter) return;
        this.setBtn(this.buttons.lockIdentity, true, 'جاري التأكيد...');
        
        try {
            const roomRef = doc(db, "rooms", this.currentRoomCode);
            const roomSnap = await getDoc(roomRef);
            let players = roomSnap.data().players;
            
            const shuffledPowerups = [...POWERUPS_LIST].sort(() => 0.5 - Math.random());
            const myPowerups = [shuffledPowerups[0].id, shuffledPowerups[1].id];

            const updatedPlayers = players.map(p => {
                if (p.name === this.playerName) {
                    return { ...p, identityLocked: true, character: this.selectedCharacter, powerups: myPowerups };
                }
                return p;
            });

            await updateDoc(roomRef, { players: updatedPlayers });
            this.displays.waitingLockMsg.style.display = 'block';
            this.setBtn(this.buttons.lockIdentity, true, 'تم التأكيد');

            const allLocked = updatedPlayers.every(p => p.identityLocked === true);
            if (allLocked && updatedPlayers.length === 2) {
                await updateDoc(roomRef, { 
                    status: 'playing',
                    currentTurnIndex: 0,
                    doubleTurnActive: false,
                    turnStartTime: Date.now(),
                    roundStartTime: Date.now(),
                    roundDuration: 600,
                    pendingQuestion: null,
                    gameLog: [{ type: 'system', text: 'بدأت اللعبة! الهوست يبدأ طرح السؤال الأول.' }]
                });
            }
        } catch (error) { console.error(error); alert("خطأ."); }
    }

    async handleSendQuestion() {
        const qText = this.inputs.question.value.trim();
        if (!qText) return;

        this.inputs.question.value = '';
        const roomRef = doc(db, "rooms", this.currentRoomCode);
        const data = this.roomDataCache;

        const updatedPlayers = data.players.map(p => p.name === this.playerName ? { ...p, questionsAsked: p.questionsAsked + 1 } : p);
        const newLog = [...data.gameLog, { type: 'question', text: `${this.playerName}: ${qText}` }];

        await updateDoc(roomRef, {
            players: updatedPlayers,
            pendingQuestion: { text: qText, askedBy: this.playerName },
            gameLog: newLog,
            turnStartTime: Date.now()
        });
    }

    async handleAnswerQuestion(answerText) {
        const roomRef = doc(db, "rooms", this.currentRoomCode);
        const data = this.roomDataCache;

        let updatedPlayers = [...data.players];
        if (answerText === 'لا أعرف') {
            const myData = updatedPlayers.find(p => p.name === this.playerName);
            if (myData.dontKnowCount >= 3) { alert("استنفذت خيار لا أعرف (3 مرات كحد أقصى)!"); return; }
            updatedPlayers = updatedPlayers.map(p => p.name === this.playerName ? { ...p, dontKnowCount: p.dontKnowCount + 1 } : p);
        }

        const newLog = [...data.gameLog, { type: 'answer', text: `الإجابة: ${answerText}` }];
        
        // التحقق من ميزة الضربة المزدوجة
        let nextTurnIndex = data.currentTurnIndex === 0 ? 1 : 0;
        let keepDouble = false;
        
        if (data.doubleTurnActive) {
            nextTurnIndex = data.currentTurnIndex; // إبقاء الدور عند نفس السائل
            keepDouble = false; // استهلاك الميزة
        }

        await updateDoc(roomRef, {
            players: updatedPlayers,
            pendingQuestion: null,
            gameLog: newLog,
            currentTurnIndex: nextTurnIndex,
            doubleTurnActive: keepDouble,
            turnStartTime: Date.now()
        });
    }

    async handleMakeGuess(char) {
        this.displays.guessModal.style.display = 'none';
        const roomRef = doc(db, "rooms", this.currentRoomCode);
        const data = this.roomDataCache;
        
        const opponent = data.players.find(p => p.name !== this.playerName);
        const myData = data.players.find(p => p.name === this.playerName);

        if (myData.guessesLeft <= 0) { alert("استنفذت جميع محاولات التخمين (3/3)!"); return; }

        const isCorrect = opponent.character.name.toLowerCase() === char.name.toLowerCase();

        if (isCorrect) {
            await updateDoc(roomRef, {
                status: 'ended',
                winner: this.playerName,
                endReason: `كشف هوية الخصم بنجاح: (${char.name})`
            });
        } else {
            const newGuessesLeft = myData.guessesLeft - 1;
            const updatedPlayers = data.players.map(p => p.name === this.playerName ? { ...p, guessesLeft: newGuessesLeft } : p);
            const nextTurnIndex = data.currentTurnIndex === 0 ? 1 : 0;
            const newLog = [...data.gameLog, { type: 'system', text: `خمن ${this.playerName} شخصية (${char.name}) وكان التخمين خاطئاً! انتقل الدور للخصم.` }];

            await updateDoc(roomRef, {
                players: updatedPlayers,
                currentTurnIndex: nextTurnIndex,
                gameLog: newLog,
                turnStartTime: Date.now()
            });
        }
    }

    // --- البرمجة الشاملة للـ 6 Power-ups ---
    async triggerPowerup(powerupId) {
        const roomRef = doc(db, "rooms", this.currentRoomCode);
        const data = this.roomDataCache;
        const myData = data.players.find(p => p.name === this.playerName);
        const opponent = data.players.find(p => p.name !== this.playerName);

        const updatedMyPowerups = myData.powerups.filter(p => p !== powerupId);
        let updatedPlayers = data.players.map(p => p.name === this.playerName ? { ...p, powerups: updatedMyPowerups } : p);

        let logText = `استخدم ${this.playerName} عنصر خاص!`;

        if (powerupId === 'freeze') {
            await updateDoc(roomRef, { roundDuration: data.roundDuration + 45 });
            logText = `❄️ جمّد ${this.playerName} الزمن! ضُفت 45 ثانية للجولة.`;
        } 
        else if (powerupId === 'letter') {
            const firstLetter = opponent.character.name.charAt(0);
            alert(`🔤 الحرف الأول من هوية الخصم هو: (${firstLetter})`);
            logText = `🔤 استخدم ${this.playerName} تسريب الحرف الأول!`;
        } 
        else if (powerupId === 'shield') {
            if (!data.pendingQuestion || data.pendingQuestion.askedBy === this.playerName) {
                alert("الدرع يُستخدم فقط عند توجيه سؤال لك من الخصم!");
                return;
            }
            logText = `🛡️ فعّل ${this.playerName} درع الفيتو ورفض السؤال!`;
            const nextTurnIndex = data.currentTurnIndex === 0 ? 1 : 0;
            await updateDoc(roomRef, { pendingQuestion: null, currentTurnIndex: nextTurnIndex });
        }
        else if (powerupId === 'double') {
            logText = `⚡ فعّل ${this.playerName} الضربة المزدوجة! وسيطرح سؤالين متتاليين.`;
            await updateDoc(roomRef, { doubleTurnActive: true });
        }
        else if (powerupId === 'steal') {
            if (opponent.powerups.length === 0) {
                alert("الخصم لا يملك أي عناصر خاصة لسرقتها!");
                return;
            }
            const stolenP = opponent.powerups[0];
            const updatedOpponentPowerups = opponent.powerups.slice(1);
            
            updatedPlayers = updatedPlayers.map(p => {
                if (p.name === this.playerName) return { ...p, powerups: [...updatedMyPowerups, stolenP] };
                if (p.name === opponent.name) return { ...p, powerups: updatedOpponentPowerups };
                return p;
            });
            logText = `🥷 سرق ${this.playerName} عنصراً خاصاً من الخصم!`;
        }
        else if (powerupId === 'category') {
            alert(`🔍 فئة شخصية الخصم هي: (أنمي / شخصية خيالية)`);
            logText = `🔍 كشف ${this.playerName} فئة شخصية الخصم!`;
        }

        const newLog = [...data.gameLog, { type: 'system', text: logText }];
        await updateDoc(roomRef, { players: updatedPlayers, gameLog: newLog });
    }

    listenToRoom() {
        const roomRef = doc(db, "rooms", this.currentRoomCode);
        this.unsubscribe = onSnapshot(roomRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                this.roomDataCache = data;
                
                if (data.status === 'waiting') {
                    this.displays.playerCount.innerText = data.players.length;
                    this.displays.playersList.innerHTML = ''; 
                    data.players.forEach(p => {
                        const li = document.createElement('li');
                        li.innerHTML = `${p.isHost ? '<i class="fa-solid fa-crown" style="color: gold;"></i>' : '<i class="fa-solid fa-user"></i>'} ${p.name}`;
                        this.displays.playersList.appendChild(li);
                    });
                    if (this.isHost) this.buttons.startPrep.disabled = data.players.length !== 2;
                }
                
                if (data.status === 'prep') {
                    if (this.views.room.classList.contains('active')) this.switchView(this.views.identity);
                }

                if (data.status === 'playing') {
                    if (!this.views.game.classList.contains('active')) this.switchView(this.views.game);
                    this.renderGameBoard(data);
                }

                if (data.status === 'ended') {
                    this.renderGameOver(data);
                }
            }
        });
    }

    renderGameBoard(data) {
        const activePlayer = data.players[data.currentTurnIndex];
        const isMyTurn = activePlayer.name === this.playerName;
        const myData = data.players.find(p => p.name === this.playerName);

        this.startLocalTimers(data.turnStartTime, data.roundStartTime, data.roundDuration, isMyTurn);

        this.displays.turnIndicator.innerText = isMyTurn ? 'دورك الآن!' : `دور ${activePlayer.name}`;
        this.displays.turnIndicator.style.color = isMyTurn ? 'var(--cyan-glow)' : 'var(--coral-glow)';
        
        this.displays.myQuestionsCount.innerText = myData.questionsAsked;
        this.displays.myGuessesLeft.innerText = `${myData.guessesLeft}/3`;
        this.displays.dontKnowCountDisplay.innerText = 3 - myData.dontKnowCount;

        this.displays.gameLogBox.innerHTML = '';
        data.gameLog.forEach(log => {
            const div = document.createElement('div');
            div.className = `log-msg ${log.type}`;
            div.innerText = log.text;
            this.displays.gameLogBox.appendChild(div);
        });
        this.displays.gameLogBox.scrollTop = this.displays.gameLogBox.scrollHeight;

        // إدارة حالات الانتظار والأسئلة
        if (data.pendingQuestion) {
            this.displays.activeTurnArea.style.display = 'none';
            if (data.pendingQuestion.askedBy !== this.playerName) {
                this.displays.pendingQuestionArea.style.display = 'block';
                this.displays.waitingAnswerArea.style.display = 'none';
                this.displays.pendingQuestionText.innerText = data.pendingQuestion.text;
            } else {
                this.displays.pendingQuestionArea.style.display = 'none';
                this.displays.waitingAnswerArea.style.display = 'block';
            }
        } else {
            this.displays.pendingQuestionArea.style.display = 'none';
            this.displays.waitingAnswerArea.style.display = 'none';
            this.displays.activeTurnArea.style.display = isMyTurn ? 'block' : 'none';
        }

        this.displays.powerupsContainer.innerHTML = '';
        myData.powerups.forEach(pId => {
            const pInfo = POWERUPS_LIST.find(p => p.id === pId);
            if (pInfo) {
                const card = document.createElement('div');
                card.className = 'powerup-card';
                card.innerHTML = `<i class="fa-solid ${pInfo.icon}"></i> ${pInfo.name}`;
                card.addEventListener('click', () => this.triggerPowerup(pId));
                this.displays.powerupsContainer.appendChild(card);
            }
        });
    }

    startLocalTimers(turnStart, roundStart, duration, isMyTurn) {
        clearInterval(this.localTimerInterval);
        this.localTimerInterval = setInterval(() => {
            const now = Date.now();
            
            const turnElapsed = Math.floor((now - turnStart) / 1000);
            const turnRemaining = Math.max(0, 25 - turnElapsed);
            this.displays.turnTimer.innerText = turnRemaining;

            const roundElapsed = Math.floor((now - roundStart) / 1000);
            const roundRemaining = Math.max(0, duration - roundElapsed);
            const mins = Math.floor(roundRemaining / 60);
            const secs = roundRemaining % 60;
            this.displays.roundTimer.innerText = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

            if (turnRemaining === 0 && isMyTurn) {
                clearInterval(this.localTimerInterval);
                this.handleAnswerQuestion('تخطى (انتهى الوقت)');
            }

            if (roundRemaining === 0 && this.isHost) {
                clearInterval(this.localTimerInterval);
                this.handleTimeOutEndGame();
            }
        }, 1000);
    }

    async handleTimeOutEndGame() {
        const roomRef = doc(db, "rooms", this.currentRoomCode);
        const data = this.roomDataCache;

        const p1 = data.players[0];
        const p2 = data.players[1];
        let winner = 'تعادل (Draw)';
        
        if (p1.questionsAsked < p2.questionsAsked) winner = p1.name;
        else if (p2.questionsAsked < p1.questionsAsked) winner = p2.name;

        await updateDoc(roomRef, { status: 'ended', winner, endReason: 'انتهى الوقت العام للجولة (حُسمت بالأسئلة الأقل)' });
    }

    renderGameOver(data) {
        clearInterval(this.localTimerInterval);
        this.switchView(this.views.gameOver);
        
        if (data.winner === 'تعادل (Draw)') {
            this.displays.gameOverTitle.innerText = "🤝 تعادل!";
            this.displays.gameOverSub.innerText = data.endReason;
        } else if (data.winner === this.playerName) {
            this.displays.gameOverTitle.innerText = "🏆 انتصار!";
            this.displays.gameOverSub.innerText = data.endReason;
        } else {
            this.displays.gameOverTitle.innerText = "💀 خسارة!";
            this.displays.gameOverTitle.style.color = "var(--coral-glow)";
            this.displays.gameOverSub.innerText = `الفائز هو ${data.winner}`;
        }

        this.displays.revealedIdentitiesBox.innerHTML = '';
        data.players.forEach(p => {
            if (p.character) {
                this.displays.revealedIdentitiesBox.innerHTML += `
                    <div style="margin-bottom: 10px;">
                        <img src="${p.character.imageUrl}" style="width: 50px; height: 50px; border-radius: 50%;">
                        <p><strong>${p.name}:</strong> ${p.character.name}</p>
                    </div>
                `;
            }
        });
    }

    setBtn(btn, isLoading, text) {
        btn.disabled = isLoading;
        btn.innerHTML = isLoading ? `<i class="fa-solid fa-spinner fa-spin"></i> ${text}` : text;
    }
}

document.addEventListener('DOMContentLoaded', () => new IDClashGame());