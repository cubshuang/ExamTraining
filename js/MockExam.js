/**
 * MockExam.js - 模擬試題測驗模組
 * 包含：測驗參數設定、多題庫隨機抽題、作答互動、自動評分與錯題解析報告
 */

var MockExam = (function() {
    // 測驗執行狀態
    var state = {
        active: false,
        phase: 'settings', // 'settings' | 'quiz' | 'result'
        questions: [],     // 當次隨機抽選出的題目
        currentIndex: 0,   // 當前題號索引 (0-based)
        answers: {},       // 使用者作答記錄 { [index]: ['A', ...] }
        startTime: null,
        timerInterval: null,
        elapsedSeconds: 0,
        result: null       // 成績計算結果
    };

    /**
     * Fisher-Yates 隨機洗牌演算法
     */
    function shuffleArray(array) {
        var arr = array.slice();
        for (var i = arr.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = arr[i];
            arr[i] = arr[j];
            arr[j] = temp;
        }
        return arr;
    }

    /**
     * 秒數格式化 (MM:SS)
     */
    function formatTime(seconds) {
        var m = Math.floor(seconds / 60);
        var s = seconds % 60;
        return (m < 10 ? "0" + m : m) + ":" + (s < 10 ? "0" + s : s);
    }

    /**
     * 取得設定檔中的預設參數
     */
    function getDefaultSettings() {
        var cfg = (typeof examSettings !== "undefined" && examSettings.mockExam)
            ? examSettings.mockExam
            : (window.mockExamSettings || {});

        var totalQuestions = cfg.totalQuestions || 50;
        var banksConfig = cfg.banks || [];

        // 取得所有可用題庫
        var allExams = (typeof examSettings !== "undefined" && examSettings.exams)
            ? examSettings.exams
            : (window.examConfig || []);

        var bankSettings = [];
        allExams.forEach(function(examItem) {
            var found = banksConfig.find(function(b) { return b.examId === examItem.id; });
            bankSettings.push({
                id: examItem.id,
                name: examItem.name,
                file: examItem.file,
                enabled: found ? true : (banksConfig.length === 0),
                count: found ? found.count : 0
            });
        });

        // 若無明確配置各題庫，平均分配
        var enabledList = bankSettings.filter(function(b) { return b.enabled; });
        if (enabledList.length > 0 && enabledList.every(function(b) { return b.count === 0; })) {
            var perCount = Math.floor(totalQuestions / enabledList.length);
            var remainder = totalQuestions % enabledList.length;
            enabledList.forEach(function(b, idx) {
                b.count = perCount + (idx === 0 ? remainder : 0);
            });
        }

        return {
            totalQuestions: totalQuestions,
            banks: bankSettings
        };
    }

    /**
     * 初始化模組
     */
    function init() {
        initDOMElements();
        renderSettingsPanel();
        bindGlobalEvents();
    }

    /**
     * 綁定頂部模式切換等事件
     */
    function bindGlobalEvents() {
        var btnPractice = document.getElementById("btnModePractice");
        var btnMock = document.getElementById("btnModeMock");

        if (btnPractice) {
            btnPractice.addEventListener("click", function() {
                switchAppMode("practice");
            });
        }
        if (btnMock) {
            btnMock.addEventListener("click", function() {
                switchAppMode("mock");
            });
        }
    }

    /**
     * 切換應用程式模式 (循序練習 vs 模擬測驗)
     */
    function switchAppMode(mode) {
        var practiceControls = document.getElementById("headerPracticeControls");
        var mockControls = document.getElementById("headerMockControls");
        var practiceCard = document.querySelector(".quiz-card");
        var mockContainer = document.getElementById("mockContainer");
        var btnPractice = document.getElementById("btnModePractice");
        var btnMock = document.getElementById("btnModeMock");
        var shortcutsGuide = document.querySelector(".shortcuts-guide");

        if (mode === "practice") {
            if (btnPractice) btnPractice.classList.add("active");
            if (btnMock) btnMock.classList.remove("active");
            if (practiceControls) practiceControls.style.display = "flex";
            if (mockControls) mockControls.style.display = "none";
            if (practiceCard) practiceCard.style.display = "block";
            if (mockContainer) mockContainer.style.display = "none";
            if (shortcutsGuide) {
                shortcutsGuide.innerHTML = '<span class="sc-item"><kbd>←</kbd> 上一題</span>'
                    + '<span class="sc-item"><kbd>→</kbd> 下一題</span>'
                    + '<span class="sc-item"><kbd>Enter</kbd> 看答案</span>'
                    + '<span class="sc-item"><kbd>↑</kbd> <kbd>↓</kbd> 移動選項</span>'
                    + '<span class="sc-item"><kbd>Space</kbd> / <kbd>Alt</kbd> 勾選</span>';
            }

            // 恢復當前考卷全域變數指向
            if (window.currentExam && window.bankCache && window.bankCache[window.currentExam.id]) {
                window.exam = window.bankCache[window.currentExam.id].questions;
                window.examName = window.bankCache[window.currentExam.id].name;
            }
            state.active = false;
        } else {
            if (btnPractice) btnPractice.classList.remove("active");
            if (btnMock) btnMock.classList.add("active");
            if (practiceControls) practiceControls.style.display = "none";
            if (practiceCard) practiceCard.style.display = "none";
            if (mockContainer) mockContainer.style.display = "block";
            state.active = true;

            if (state.phase === "quiz") {
                if (mockControls) mockControls.style.display = "flex";
                showMockPanel("quiz");
                if (shortcutsGuide) {
                    shortcutsGuide.innerHTML = '<span class="sc-item"><kbd>←</kbd> 上一題</span>'
                        + '<span class="sc-item"><kbd>→</kbd> 下一題</span>'
                        + '<span class="sc-item"><kbd>↑</kbd> <kbd>↓</kbd> 移動選項</span>'
                        + '<span class="sc-item"><kbd>Space</kbd> 勾選選項</span>'
                        + '<span class="sc-item"><kbd>Enter</kbd> 下一題</span>';
                }
            } else if (state.phase === "result") {
                if (mockControls) mockControls.style.display = "none";
                showMockPanel("result");
            } else {
                if (mockControls) mockControls.style.display = "none";
                showMockPanel("settings");
            }
        }
    }

    /**
     * 顯示指定的模擬測驗面板
     */
    function showMockPanel(panelName) {
        state.phase = panelName;
        var pSettings = document.getElementById("mockSettingsPanel");
        var pQuiz = document.getElementById("mockQuizPanel");
        var pResult = document.getElementById("mockResultPanel");
        var mockControls = document.getElementById("headerMockControls");

        if (pSettings) pSettings.style.display = (panelName === "settings") ? "block" : "none";
        if (pQuiz) pQuiz.style.display = (panelName === "quiz") ? "block" : "none";
        if (pResult) pResult.style.display = (panelName === "result") ? "block" : "none";
        if (mockControls) mockControls.style.display = (panelName === "quiz") ? "flex" : "none";
    }

    /**
     * 建立與掛載 DOM 節點結構
     */
    function initDOMElements() {
        // 檢查頂部標題左側是否已加入模式切換鈕
        var headerLeft = document.querySelector(".header-left");
        if (headerLeft && !document.getElementById("btnModePractice")) {
            var modeSwitch = document.createElement("div");
            modeSwitch.className = "mode-switch";
            modeSwitch.innerHTML = '<button type="button" class="mode-btn active" id="btnModePractice">📘 循序練習</button>'
                + '<button type="button" class="mode-btn" id="btnModeMock">🎯 模擬測驗</button>';
            headerLeft.appendChild(modeSwitch);
        }

        // 標記練習模式控制區 ID
        var qaNoRight = document.querySelector(".header-right.qaNo");
        if (qaNoRight && !qaNoRight.id) {
            qaNoRight.id = "headerPracticeControls";
        }

        // 建立或取得模擬測驗頂部控制項 (計時器、題號跳轉、設定按鈕)
        var appHeader = document.querySelector(".app-header");
        var mockControls = document.getElementById("headerMockControls");
        if (!mockControls && appHeader) {
            mockControls = document.createElement("div");
            mockControls.className = "header-right qaNo";
            mockControls.id = "headerMockControls";
            mockControls.style.display = "none";
            mockControls.innerHTML = '<div class="mock-timer-box"><span class="timer-icon">⏱️</span><span id="mockTimer">00:00</span></div>'
                + '<div class="select-wrapper">'
                + '<label for="mockQaNo" class="select-label">題號：</label>'
                + '<select id="mockQaNo" title="選擇題號"></select>'
                + '</div>'
                + '<button type="button" class="btn btn-outline" id="btnMockSettingsToggle">⚙️ 設定</button>';
            appHeader.appendChild(mockControls);
        }

        if (mockControls) {
            var btnSettingsToggle = mockControls.querySelector("#btnMockSettingsToggle");
            if (btnSettingsToggle && !btnSettingsToggle._hasListener) {
                btnSettingsToggle._hasListener = true;
                btnSettingsToggle.addEventListener("click", function() {
                    if (state.phase === "quiz") {
                        if (confirm("測驗正在進行中，返回設定將中斷本次測驗，是否確定？")) {
                            stopTimer();
                            showMockPanel("settings");
                        }
                    } else {
                        showMockPanel("settings");
                    }
                });
            }

            var mockSelect = mockControls.querySelector("#mockQaNo");
            if (mockSelect && !mockSelect._hasListener) {
                mockSelect._hasListener = true;
                mockSelect.addEventListener("change", function() {
                    var targetIdx = parseInt(this.value, 10);
                    if (!isNaN(targetIdx)) {
                        goToQuestion(targetIdx);
                    }
                });
            }
        }

        // 建立模擬測驗容器
        var appContainer = document.querySelector(".app-container");
        var quizCard = document.querySelector(".quiz-card");
        if (appContainer && !document.getElementById("mockContainer")) {
            var mockContainer = document.createElement("div");
            mockContainer.id = "mockContainer";
            mockContainer.style.display = "none";
            mockContainer.innerHTML = '<!-- 1. 模擬測驗設定卡片 -->'
                + '<div id="mockSettingsPanel" class="quiz-card mock-card"></div>'
                + '<!-- 2. 模擬測驗作答卡片 -->'
                + '<div id="mockQuizPanel" class="quiz-card mock-card" style="display:none;"></div>'
                + '<!-- 3. 模擬測驗成績結算卡片 -->'
                + '<div id="mockResultPanel" class="quiz-card mock-card" style="display:none;"></div>';

            if (quizCard) {
                appContainer.insertBefore(mockContainer, quizCard.nextSibling);
            } else {
                appContainer.appendChild(mockContainer);
            }
        }
    }

    /**
     * 渲染模擬試題參數設定介面
     */
    function renderSettingsPanel() {
        var panel = document.getElementById("mockSettingsPanel");
        if (!panel) return;

        var defaults = getDefaultSettings();

        var html = '<div class="settings-header">'
            + '<h2>🎯 模擬試題參數設定</h2>'
            + '<p class="settings-desc">自訂抽題規則與題庫配題，點擊下方按鈕即可隨機產生試卷開始測驗。</p>'
            + '</div>'
            + '<div class="settings-body">'
            + '  <div class="setting-group">'
            + '    <label class="setting-label">1. 每次測驗出題題數：</label>'
            + '    <div class="total-input-wrapper">'
            + '      <input type="number" id="inputMockTotal" class="form-input" min="1" max="1000" value="' + defaults.totalQuestions + '">'
            + '      <span class="unit-text">題</span>'
            + '      <div class="quick-tags">'
            + '        <button type="button" class="tag-btn" data-val="20">20 題</button>'
            + '        <button type="button" class="tag-btn" data-val="50">50 題 (標準)</button>'
            + '        <button type="button" class="tag-btn" data-val="100">100 題</button>'
            + '      </div>'
            + '    </div>'
            + '  </div>'
            + '  <div class="setting-group">'
            + '    <div class="group-title-row">'
            + '      <label class="setting-label">2. 題庫來源與出題數設定 (可多選)：</label>'
            + '      <span class="sub-tip">可設定各題庫抽取之題數，系統將自動連動總出題數</span>'
            + '    </div>'
            + '    <div class="bank-list" id="mockBankList">';

        defaults.banks.forEach(function(bank, idx) {
            html += '<div class="bank-item" data-bank-id="' + bank.id + '">'
                + '  <div class="bank-item-left">'
                + '    <input type="checkbox" id="chkBank_' + bank.id + '" class="bank-chk" ' + (bank.enabled ? 'checked' : '') + '>'
                + '    <label for="chkBank_' + bank.id + '" class="bank-name-label">' + bank.name + '</label>'
                + '  </div>'
                + '  <div class="bank-item-right">'
                + '    <span class="count-label">抽題數：</span>'
                + '    <input type="number" id="countBank_' + bank.id + '" class="form-input bank-count-input" min="0" max="1000" value="' + bank.count + '" ' + (bank.enabled ? '' : 'disabled') + '>'
                + '    <span class="unit-text">題</span>'
                + '  </div>'
                + '</div>';
        });

        html += '    </div>'
            + '  </div>'
            + '</div>'
            + '<div class="settings-footer">'
            + '  <button type="button" class="btn btn-secondary" id="btnResetSettings">🔄 恢復預設設定</button>'
            + '  <button type="button" class="btn btn-primary btn-lg" id="btnStartMockExam">🚀 開始模擬測驗</button>'
            + '</div>';

        panel.innerHTML = html;

        // 綁定設定面板互動事件
        var inputTotal = panel.querySelector("#inputMockTotal");
        var bankList = panel.querySelector("#mockBankList");

        // 快速題數標籤點擊
        panel.querySelectorAll(".tag-btn").forEach(function(btn) {
            btn.addEventListener("click", function() {
                var val = parseInt(this.getAttribute("data-val"), 10);
                if (inputTotal) inputTotal.value = val;
                recalculateBankCountsFromTotal(val);
            });
        });

        // 核取方塊與題數連動
        panel.querySelectorAll(".bank-chk").forEach(function(chk) {
            chk.addEventListener("change", function() {
                var bankId = this.id.replace("chkBank_", "");
                var countInput = panel.querySelector("#countBank_" + bankId);
                if (countInput) {
                    countInput.disabled = !this.checked;
                    if (!this.checked) {
                        countInput.value = 0;
                    } else if (parseInt(countInput.value, 10) <= 0) {
                        countInput.value = 20;
                    }
                }
                syncTotalFromBanks();
            });
        });

        panel.querySelectorAll(".bank-count-input").forEach(function(input) {
            input.addEventListener("input", function() {
                syncTotalFromBanks();
            });
        });

        // 恢復預設值
        var btnReset = panel.querySelector("#btnResetSettings");
        if (btnReset) {
            btnReset.addEventListener("click", function() {
                renderSettingsPanel();
            });
        }

        // 開始模擬測驗
        var btnStart = panel.querySelector("#btnStartMockExam");
        if (btnStart) {
            btnStart.addEventListener("click", function() {
                startMockExamFromSettings();
            });
        }
    }

    /**
     * 依據各題庫題數加總並同步總題數
     */
    function syncTotalFromBanks() {
        var panel = document.getElementById("mockSettingsPanel");
        if (!panel) return;
        var total = 0;
        panel.querySelectorAll(".bank-item").forEach(function(item) {
            var chk = item.querySelector(".bank-chk");
            var input = item.querySelector(".bank-count-input");
            if (chk && chk.checked && input) {
                total += (parseInt(input.value, 10) || 0);
            }
        });
        var inputTotal = panel.querySelector("#inputMockTotal");
        if (inputTotal) inputTotal.value = total;
    }

    /**
     * 當手動點選總題數快捷標籤時，平均分配給已勾選的題庫
     */
    function recalculateBankCountsFromTotal(total) {
        var panel = document.getElementById("mockSettingsPanel");
        if (!panel) return;
        var enabledItems = [];
        panel.querySelectorAll(".bank-item").forEach(function(item) {
            var chk = item.querySelector(".bank-chk");
            if (chk && chk.checked) enabledItems.push(item);
        });

        if (enabledItems.length === 0) return;
        var perCount = Math.floor(total / enabledItems.length);
        var remainder = total % enabledItems.length;

        enabledItems.forEach(function(item, idx) {
            var input = item.querySelector(".bank-count-input");
            if (input) {
                input.value = perCount + (idx === 0 ? remainder : 0);
            }
        });
    }

    /**
     * 從目前設定面板收集參數並啟動測驗
     */
    function startMockExamFromSettings() {
        var panel = document.getElementById("mockSettingsPanel");
        if (!panel) return;

        var selectedBanks = [];
        var totalCount = 0;

        panel.querySelectorAll(".bank-item").forEach(function(item) {
            var chk = item.querySelector(".bank-chk");
            var countInput = item.querySelector(".bank-count-input");
            var bankId = item.getAttribute("data-bank-id");

            if (chk && chk.checked && countInput) {
                var count = parseInt(countInput.value, 10) || 0;
                if (count > 0) {
                    var examItem = (examSettings.exams || []).find(function(e) { return e.id === bankId; });
                    if (examItem) {
                        selectedBanks.push({
                            examItem: examItem,
                            count: count
                        });
                        totalCount += count;
                    }
                }
            }
        });

        if (selectedBanks.length === 0 || totalCount <= 0) {
            alert("請至少勾選一個題庫並設定大於 0 的抽題數！");
            return;
        }

        // 載入所選題庫並隨機抽選題目
        var btnStart = panel.querySelector("#btnStartMockExam");
        if (btnStart) {
            btnStart.disabled = true;
            btnStart.innerText = "⏳ 載入題庫中...";
        }

        var examItemsToLoad = selectedBanks.map(function(b) { return b.examItem; });

        loadMultipleExamBanks(examItemsToLoad, function(curr, total, item) {
            if (btnStart) btnStart.innerText = "⏳ 載入題庫 (" + curr + "/" + total + ")...";
        }, function(err, resultsMap) {
            if (btnStart) {
                btnStart.disabled = false;
                btnStart.innerText = "🚀 開始模擬測驗";
            }

            if (err) {
                alert("載入題庫發生錯誤：" + err.message);
                return;
            }

            // 抽題處理
            var allSampledQuestions = [];
            selectedBanks.forEach(function(cfg) {
                var bankData = resultsMap[cfg.examItem.id];
                if (bankData && bankData.questions && bankData.questions.length > 0) {
                    var shuffledBank = shuffleArray(bankData.questions);
                    var sampleCount = Math.min(cfg.count, shuffledBank.length);
                    for (var i = 0; i < sampleCount; i++) {
                        var q = shuffledBank[i];
                        allSampledQuestions.push({
                            bankId: cfg.examItem.id,
                            bankName: bankData.name,
                            id: q.id,
                            question: q.question,
                            ansItem: q.ansItem,
                            answer: q.answer,
                            answerMemo: q.answerMemo || ""
                        });
                    }
                }
            });

            if (allSampledQuestions.length === 0) {
                alert("未能從選定題庫中取得任何有效題目，請確認題庫檔案！");
                return;
            }

            // 隨機打散合併後的題目
            allSampledQuestions = shuffleArray(allSampledQuestions);
            allSampledQuestions.forEach(function(q, idx) {
                q.mockIndex = idx;
            });

            // 初始化測驗狀態
            state.questions = allSampledQuestions;
            state.currentIndex = 0;
            state.answers = {};
            state.startTime = Date.now();
            state.elapsedSeconds = 0;
            state.result = null;

            // 啟動計時器
            startTimer();

            // 更新題號下拉選單
            updateMockQaSelect();

            // 切換至測驗面板並顯示第一題
            showMockPanel("quiz");
            renderCurrentQuestion();
        });
    }

    /**
     * 計時器控制
     */
    function startTimer() {
        stopTimer();
        var timerEl = document.getElementById("mockTimer");
        state.elapsedSeconds = 0;
        if (timerEl) timerEl.innerText = "00:00";
        state.timerInterval = setInterval(function() {
            state.elapsedSeconds++;
            if (timerEl) {
                timerEl.innerText = formatTime(state.elapsedSeconds);
            }
        }, 1000);
    }

    function stopTimer() {
        if (state.timerInterval) {
            clearInterval(state.timerInterval);
            state.timerInterval = null;
        }
    }

    /**
     * 更新模擬測驗題號下拉跳轉選單
     */
    function updateMockQaSelect() {
        var select = document.getElementById("mockQaNo");
        if (!select) return;
        select.innerHTML = "";
        state.questions.forEach(function(q, idx) {
            var op = document.createElement("option");
            op.value = idx;
            var isAnswered = (state.answers[idx] && state.answers[idx].length > 0);
            op.text = "第 " + (idx + 1) + " 題" + (isAnswered ? " ✓" : "");
            select.appendChild(op);
        });
        select.value = state.currentIndex;
    }

    /**
     * 渲染當前題目
     */
    function renderCurrentQuestion() {
        var panel = document.getElementById("mockQuizPanel");
        if (!panel || state.questions.length === 0) return;

        var q = state.questions[state.currentIndex];
        var total = state.questions.length;
        var isMulti = (q.answer.indexOf(",") > 0);
        var inputType = isMulti ? "checkbox" : "radio";
        var currentAnswers = state.answers[state.currentIndex] || [];
        var answeredCount = Object.keys(state.answers).filter(function(k) {
            return state.answers[k] && state.answers[k].length > 0;
        }).length;

        // 同步題號選單
        var select = document.getElementById("mockQaNo");
        if (select) select.value = state.currentIndex;

        var html = '<div class="question-header">'
            + '  <div class="dvQNo">'
            + '    <span class="badge ' + (isMulti ? 'badge-multi' : 'badge-single') + '">' + (isMulti ? '複選題' : '單選題') + '</span>'
            + '    <span class="badge badge-bank">📚 ' + q.bankName + '</span>'
            + '    <span class="progress-info">第 ' + (state.currentIndex + 1) + ' / ' + total + ' 題</span>'
            + '  </div>'
            + '  <div class="mock-answered-stat">已作答：' + answeredCount + ' / ' + total + ' 題</div>'
            + '</div>'
            + '<div class="dvQues">' + q.question + '</div>'
            + '<div class="dvAns dvAnsOptions" id="mockOptionsArea">';

        q.ansItem.forEach(function(item) {
            var isChecked = currentAnswers.includes(item.ans);
            html += '<div class="ansItem-wrapper">'
                + '  <div class="ansItem ' + (isChecked ? 'ansSelect' : '') + '" id="mockItem_' + item.ans + '" data-ans="' + item.ans + '">'
                + '    <input type="' + inputType + '" id="mockInput_' + item.ans + '" name="mockQ_' + q.mockIndex + '" class="QAItem" ' + (isChecked ? 'checked' : '') + '>'
                + '    <span class="ansBadge">' + item.ans + '</span>'
                + '    <div class="ansCont">' + item.item + '</div>'
                + '  </div>'
                + '</div>';
        });

        html += '</div>'
            + '<div class="dvAnsBtn">'
            + '  <button type="button" class="btn btn-danger" id="btnSubmitMockExam">📋 交卷並看成績</button>'
            + '  <div class="dvQASel">'
            + '    <button type="button" class="btn btn-secondary" id="btnMockPrev" ' + (state.currentIndex === 0 ? 'disabled' : '') + '>← 上一題</button>'
            + '    <button type="button" class="btn btn-secondary" id="btnMockNext" ' + (state.currentIndex === total - 1 ? 'disabled' : '') + '>下一題 →</button>'
            + '  </div>'
            + '</div>';

        panel.innerHTML = html;

        // 綁定選項點擊事件
        panel.querySelectorAll(".ansItem").forEach(function(itemEl) {
            itemEl.addEventListener("click", function(e) {
                if (e.target && e.target.classList.contains("QAItem")) return;
                var ansId = this.getAttribute("data-ans");
                toggleOption(ansId, isMulti);
            });
        });

        panel.querySelectorAll(".QAItem").forEach(function(inputEl) {
            inputEl.addEventListener("change", function() {
                var ansId = this.id.replace("mockInput_", "");
                onOptionChanged(ansId, isMulti, this.checked);
            });
        });

        // 綁定上一題、下一題、交卷
        var btnPrev = panel.querySelector("#btnMockPrev");
        var btnNext = panel.querySelector("#btnMockNext");
        var btnSubmit = panel.querySelector("#btnSubmitMockExam");

        if (btnPrev) {
            btnPrev.addEventListener("click", function() {
                if (state.currentIndex > 0) goToQuestion(state.currentIndex - 1);
            });
        }
        if (btnNext) {
            btnNext.addEventListener("click", function() {
                if (state.currentIndex < state.questions.length - 1) {
                    goToQuestion(state.currentIndex + 1);
                }
            });
        }
        if (btnSubmit) {
            btnSubmit.addEventListener("click", function() {
                confirmAndSubmitExam();
            });
        }
    }

    /**
     * 選項狀態切換
     */
    function toggleOption(ansId, isMulti) {
        var input = document.getElementById("mockInput_" + ansId);
        if (!input) return;
        if (isMulti) {
            input.checked = !input.checked;
        } else {
            input.checked = true;
        }
        onOptionChanged(ansId, isMulti, input.checked);
    }

    function onOptionChanged(ansId, isMulti, isChecked) {
        var currentAnswers = state.answers[state.currentIndex] || [];
        if (isMulti) {
            if (isChecked) {
                if (!currentAnswers.includes(ansId)) currentAnswers.push(ansId);
            } else {
                currentAnswers = currentAnswers.filter(function(a) { return a !== ansId; });
            }
            currentAnswers.sort();
        } else {
            currentAnswers = [ansId];
        }
        state.answers[state.currentIndex] = currentAnswers;

        // 更新選項高亮樣式
        var optionsArea = document.getElementById("mockOptionsArea");
        if (optionsArea) {
            optionsArea.querySelectorAll(".ansItem").forEach(function(el) {
                var aid = el.getAttribute("data-ans");
                var inp = el.querySelector(".QAItem");
                if (currentAnswers.includes(aid)) {
                    el.classList.add("ansSelect");
                    if (inp) inp.checked = true;
                } else {
                    el.classList.remove("ansSelect");
                    if (inp) inp.checked = false;
                }
            });
        }

        // 更新頂部已作答數量與題號選單標記
        updateMockQaSelect();
        var statEl = document.querySelector(".mock-answered-stat");
        if (statEl) {
            var answeredCount = Object.keys(state.answers).filter(function(k) {
                return state.answers[k] && state.answers[k].length > 0;
            }).length;
            statEl.innerText = "已作答：" + answeredCount + " / " + state.questions.length + " 題";
        }
    }

    /**
     * 跳轉至指定題目
     */
    function goToQuestion(index) {
        if (index < 0 || index >= state.questions.length) return;
        state.currentIndex = index;
        renderCurrentQuestion();
    }

    /**
     * 確認交卷並計算成績
     */
    function confirmAndSubmitExam() {
        var total = state.questions.length;
        var answeredCount = Object.keys(state.answers).filter(function(k) {
            return state.answers[k] && state.answers[k].length > 0;
        }).length;
        var unanswered = total - answeredCount;

        if (unanswered > 0) {
            var msg = "您尚有 " + unanswered + " 題未作答！\n確定現在就要交卷並計算成績嗎？";
            if (!confirm(msg)) return;
        } else {
            if (!confirm("確定要交卷並查看測驗成果與詳細解析嗎？")) return;
        }

        finishAndCalculateScore();
    }

    /**
     * 停止測驗、計算成績並渲染報告
     */
    function finishAndCalculateScore() {
        stopTimer();

        var total = state.questions.length;
        var correctCount = 0;
        var wrongCount = 0;
        var unansweredCount = 0;

        // 依題庫統計明細
        var bankStats = {};

        var questionDetails = state.questions.map(function(q, idx) {
            var userAns = state.answers[idx] || [];
            var correctAns = q.answer.split(",").map(function(s) { return s.trim(); }).sort();
            var userAnsSorted = userAns.slice().sort();

            var isAnswered = userAns.length > 0;
            var isCorrect = isAnswered && (correctAns.join(",") === userAnsSorted.join(","));

            if (!isAnswered) {
                unansweredCount++;
            } else if (isCorrect) {
                correctCount++;
            } else {
                wrongCount++;
            }

            if (!bankStats[q.bankId]) {
                bankStats[q.bankId] = {
                    bankId: q.bankId,
                    bankName: q.bankName,
                    total: 0,
                    correct: 0
                };
            }
            bankStats[q.bankId].total++;
            if (isCorrect) bankStats[q.bankId].correct++;

            return {
                mockIndex: idx,
                bankId: q.bankId,
                bankName: q.bankName,
                question: q.question,
                ansItem: q.ansItem,
                correctAnswer: correctAns,
                userAnswer: userAnsSorted,
                isCorrect: isCorrect,
                isAnswered: isAnswered,
                answerMemo: q.answerMemo
            };
        });

        var score = Math.round((correctCount / total) * 100);
        var isPass = (score >= 70); // 70分為及格標準

        state.result = {
            total: total,
            correctCount: correctCount,
            wrongCount: wrongCount,
            unansweredCount: unansweredCount,
            score: score,
            isPass: isPass,
            accuracyRate: Math.round((correctCount / total) * 100),
            elapsedSeconds: state.elapsedSeconds,
            bankStats: bankStats,
            details: questionDetails
        };

        // 自動儲存模擬測驗紀錄至 localStorage
        if (window.HistoryManager && typeof window.HistoryManager.recordMockExam === 'function') {
            try {
                window.HistoryManager.recordMockExam(state.result);
            } catch (err) {
                console.error("儲存測驗紀錄至 localStorage 失敗:", err);
            }
        }

        renderResultPanel();
        showMockPanel("result");
    }

    /**
     * 渲染成績結算與解析面板
     */
    function renderResultPanel() {
        var panel = document.getElementById("mockResultPanel");
        if (!panel || !state.result) return;

        var res = state.result;
        var passBadgeClass = res.isPass ? "score-badge-pass" : "score-badge-fail";
        var passText = res.isPass ? "🎉 測驗及格 (合格)" : "⚠️ 未達及格標準 (需加油)";
        var commentText = res.score >= 90
            ? "太厲害了！實力頂尖，掌握度極高！"
            : (res.isPass ? "恭喜順利過關！多複習錯題能更上一層樓！" : "距離 70 分及格門檻還差一點，檢視錯題解析能快速進步！");

        var html = '<div class="result-header">'
            + '  <h2>📊 模擬試題測驗成績報告</h2>'
            + '</div>'
            + '<div class="result-summary-card">'
            + '  <div class="score-display-box">'
            + '    <div class="score-number ' + (res.isPass ? 'score-pass' : 'score-fail') + '">' + res.score + '<span class="score-unit">分</span></div>'
            + '    <div class="score-badge ' + passBadgeClass + '">' + passText + '</div>'
            + '    <div class="score-comment">' + commentText + '</div>'
            + '  </div>'
            + '  <div class="stats-grid">'
            + '    <div class="stat-card">'
            + '      <span class="stat-label">總出題數</span>'
            + '      <span class="stat-value">' + res.total + ' 題</span>'
            + '    </div>'
            + '    <div class="stat-card stat-correct">'
            + '      <span class="stat-label">答對題數</span>'
            + '      <span class="stat-value">' + res.correctCount + ' 題</span>'
            + '    </div>'
            + '    <div class="stat-card stat-wrong">'
            + '      <span class="stat-label">答錯題數</span>'
            + '      <span class="stat-value">' + res.wrongCount + ' 題</span>'
            + '    </div>'
            + '    <div class="stat-card stat-unanswered">'
            + '      <span class="stat-label">未作答題數</span>'
            + '      <span class="stat-value">' + res.unansweredCount + ' 題</span>'
            + '    </div>'
            + '    <div class="stat-card">'
            + '      <span class="stat-label">正確率</span>'
            + '      <span class="stat-value">' + res.accuracyRate + '%</span>'
            + '    </div>'
            + '    <div class="stat-card">'
            + '      <span class="stat-label">測驗用時</span>'
            + '      <span class="stat-value">' + formatTime(res.elapsedSeconds) + '</span>'
            + '    </div>'
            + '  </div>'
            + '</div>'
            + '<div class="bank-breakdown-card">'
            + '  <h3>📚 各題庫得分明細</h3>'
            + '  <div class="bank-stats-list">';

        Object.keys(res.bankStats).forEach(function(bid) {
            var bs = res.bankStats[bid];
            var rate = Math.round((bs.correct / bs.total) * 100);
            html += '<div class="bank-stat-row">'
                + '  <div class="bank-stat-info">'
                + '    <span class="bs-name">' + bs.bankName + '</span>'
                + '    <span class="bs-score">答對 ' + bs.correct + ' / ' + bs.total + ' 題 (' + rate + '%)</span>'
                + '  </div>'
                + '  <div class="progress-bar-bg">'
                + '    <div class="progress-bar-fill" style="width: ' + rate + '%;"></div>'
                + '  </div>'
                + '</div>';
        });

        html += '  </div>'
            + '</div>'
            + '<div style="text-align: center; margin-bottom: 12px;">'
            + '  <div class="record-auto-saved-badge">💾 本次測驗已自動記錄至本機 localStorage</div>'
            + '</div>'
            + '<div class="result-actions">'
            + '  <button type="button" class="btn btn-primary" id="btnRetakeMock">🔄 再測驗一次 (相同設定重新抽題)</button>'
            + '  <button type="button" class="btn btn-secondary" id="btnAdjustMockSettings">⚙️ 調整測驗設定</button>'
            + '  <button type="button" class="btn btn-secondary" id="btnViewHistoryInResult">📊 查看歷次成績紀錄</button>'
            + '  <button type="button" class="btn btn-outline" id="btnBackToPractice">📘 返回循序練習</button>'
            + '</div>'
            + '<div class="review-section">'
            + '  <div class="review-header">'
            + '    <h3>🔍 試題解析與回顧</h3>'
            + '    <div class="filter-btn-group">'
            + '      <button type="button" class="filter-btn active" data-filter="all">全部試題 (' + res.total + ')</button>'
            + '      <button type="button" class="filter-btn" data-filter="wrong">僅看錯題 (' + (res.wrongCount + res.unansweredCount) + ')</button>'
            + '      <button type="button" class="filter-btn" data-filter="correct">僅看答對 (' + res.correctCount + ')</button>'
            + '    </div>'
            + '  </div>'
            + '  <div class="review-list" id="reviewQuestionsList">';

        html += renderReviewItems(res.details, "all");

        html += '  </div>'
            + '</div>';

        panel.innerHTML = html;

        // 綁定操作按鈕
        var btnRetake = panel.querySelector("#btnRetakeMock");
        var btnAdjust = panel.querySelector("#btnAdjustMockSettings");
        var btnViewHistory = panel.querySelector("#btnViewHistoryInResult");
        var btnBackPractice = panel.querySelector("#btnBackToPractice");

        if (btnRetake) {
            btnRetake.addEventListener("click", function() {
                startMockExamFromSettings();
            });
        }
        if (btnAdjust) {
            btnAdjust.addEventListener("click", function() {
                showMockPanel("settings");
            });
        }
        if (btnViewHistory) {
            btnViewHistory.addEventListener("click", function() {
                if (window.HistoryManager && typeof window.HistoryManager.openModal === "function") {
                    window.HistoryManager.openModal("history");
                }
            });
        }
        if (btnBackPractice) {
            btnBackPractice.addEventListener("click", function() {
                switchAppMode("practice");
            });
        }

        // 題目回顧篩選按鈕
        panel.querySelectorAll(".filter-btn").forEach(function(btn) {
            btn.addEventListener("click", function() {
                panel.querySelectorAll(".filter-btn").forEach(function(b) { b.classList.remove("active"); });
                this.classList.add("active");
                var filterType = this.getAttribute("data-filter");
                var reviewList = panel.querySelector("#reviewQuestionsList");
                if (reviewList) {
                    reviewList.innerHTML = renderReviewItems(res.details, filterType);
                }
            });
        });
    }

    /**
     * 渲染回顧試題項目
     */
    function renderReviewItems(details, filter) {
        var filtered = details.filter(function(d) {
            if (filter === "wrong") return !d.isCorrect;
            if (filter === "correct") return d.isCorrect;
            return true;
        });

        if (filtered.length === 0) {
            return '<div class="empty-review-tip">無符合條件之試題 🎉</div>';
        }

        var html = "";
        filtered.forEach(function(d) {
            var statusBadge = d.isCorrect
                ? '<span class="rev-badge rev-badge-correct">✓ 答對</span>'
                : (d.isAnswered ? '<span class="rev-badge rev-badge-wrong">✗ 答錯</span>' : '<span class="rev-badge rev-badge-empty">⚠️ 未作答</span>');

            html += '<div class="review-item ' + (d.isCorrect ? 'item-correct' : 'item-wrong') + '">'
                + '  <div class="rev-item-header">'
                + '    <div class="rev-left">'
                + '      <span class="rev-qno">第 ' + (d.mockIndex + 1) + ' 題</span>'
                + '      <span class="badge badge-bank">' + d.bankName + '</span>'
                + '      ' + statusBadge
                + '    </div>'
                + '    <div class="rev-right">'
                + '      <span class="rev-ans-info">您的答案：<strong class="' + (d.isCorrect ? 'text-correct' : 'text-wrong') + '">' + (d.userAnswer.length > 0 ? d.userAnswer.join("、") : "未作答") + '</strong></span>'
                + '      <span class="rev-ans-info">正確答案：<strong class="text-correct">' + d.correctAnswer.join("、") + '</strong></span>'
                + '    </div>'
                + '  </div>'
                + '  <div class="rev-question">' + d.question + '</div>'
                + '  <div class="rev-options">';

            d.ansItem.forEach(function(opt) {
                var isRight = d.correctAnswer.includes(opt.ans);
                var isChosen = d.userAnswer.includes(opt.ans);
                var optClass = "";
                if (isRight) optClass = "rev-opt-correct";
                if (isChosen && !isRight) optClass = "rev-opt-wrong";

                html += '<div class="rev-opt ' + optClass + '">'
                    + '  <span class="rev-opt-badge">' + opt.ans + '</span>'
                    + '  <span class="rev-opt-text">' + opt.item + '</span>'
                    + (isRight ? ' <span class="rev-opt-tag correct">正確答案</span>' : '')
                    + (isChosen && !isRight ? ' <span class="rev-opt-tag wrong">您的選擇</span>' : '')
                    + '</div>';
            });

            html += '  </div>';

            if (d.answerMemo && d.answerMemo.trim() !== "") {
                html += '<div class="rev-memo"><span class="memo-tag">詳解說明</span> ' + d.answerMemo + '</div>';
            }

            html += '</div>';
        });

        return html;
    }

    /**
     * 鍵盤快速鍵處理 (當處於模擬測驗答題狀態時)
     */
    window.addEventListener("keydown", function(e) {
        if (!state.active || state.phase !== "quiz") return;

        var key = e.keyCode || e.which;
        if (key === 37) { // 左箭頭: 上一題
            if (state.currentIndex > 0) {
                goToQuestion(state.currentIndex - 1);
            }
        } else if (key === 39) { // 右箭頭: 下一題
            if (state.currentIndex < state.questions.length - 1) {
                goToQuestion(state.currentIndex + 1);
            }
        } else if (key === 13) { // Enter: 下一題
            if (state.currentIndex < state.questions.length - 1) {
                goToQuestion(state.currentIndex + 1);
            }
        }
    });

    return {
        init: init,
        switchMode: switchAppMode,
        state: state
    };
})();
