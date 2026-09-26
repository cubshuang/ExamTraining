/**
 * HistoryManager.js - 測驗歷史紀錄與個人錯題本管理器 (基於 localStorage)
 * 
 * 主要功能：
 * 1. 歷次模擬測驗成績記錄 (測驗日期、分數、及格狀態、耗時、各科正確率、錯題清單)
 * 2. 個人錯題本 (自動收集循序練習與模擬測驗中答錯的題目，支援篩選、搜尋、個別移除與複習)
 * 3. 循序練習進度記憶 (自動儲存各題庫上次練習的題號，下次進入自動接續)
 * 4. 學習成效統計儀表板 (累積測驗次數、平均分、及格率、得分分佈)
 * 5. 資料備份與還原 (支援一鍵匯出 JSON 檔案與匯入還原)
 */

var HistoryManager = (function() {
    'use strict';

    // localStorage 鍵值定義
    var STORAGE_KEYS = {
        HISTORY: 'exam_app_history_v1',
        WRONG_NOTEBOOK: 'exam_app_wrong_notebook_v1',
        PRACTICE_PROGRESS: 'exam_app_practice_progress_v1'
    };

    var MAX_HISTORY_ITEMS = 50; // 最多保留 50 筆模擬測驗紀錄
    var currentActiveTab = 'history'; // 'history' | 'wrong' | 'stats' | 'backup'
    var wrongNotebookFilterBank = 'all';
    var wrongNotebookSearchKeyword = '';

    // 安全的 localStorage 封裝 (避免無痕模式或被封鎖時拋出例外)
    var storage = {
        getItem: function(key) {
            try {
                return localStorage.getItem(key);
            } catch (e) {
                console.warn('localStorage 存取失敗:', e);
                return null;
            }
        },
        setItem: function(key, val) {
            try {
                localStorage.setItem(key, val);
                return true;
            } catch (e) {
                console.warn('localStorage 寫入失敗 (可能已滿或被禁用):', e);
                return false;
            }
        },
        removeItem: function(key) {
            try {
                localStorage.removeItem(key);
                return true;
            } catch (e) {
                return false;
            }
        }
    };

    /**
     * 格式化日期時間 (YYYY/MM/DD HH:mm)
     */
    function formatDateTime(d) {
        if (!d) d = new Date();
        var y = d.getFullYear();
        var m = ('0' + (d.getMonth() + 1)).slice(-2);
        var day = ('0' + d.getDate()).slice(-2);
        var h = ('0' + d.getHours()).slice(-2);
        var min = ('0' + d.getMinutes()).slice(-2);
        return y + '/' + m + '/' + day + ' ' + h + ':' + min;
    }

    /**
     * 格式化秒數為 mm:ss 或 X分Y秒
     */
    function formatDuration(sec) {
        var m = Math.floor(sec / 60);
        var s = sec % 60;
        if (m === 0) return s + ' 秒';
        return m + ' 分 ' + s + ' 秒';
    }

    /* ==========================================================================
       資料層操作 (Data Access Layer)
       ========================================================================== */

    /**
     * 取得歷次模擬測驗紀錄
     * @returns {Array} 測驗紀錄清單 (新 -> 舊)
     */
    function getExamHistory() {
        var raw = storage.getItem(STORAGE_KEYS.HISTORY);
        if (!raw) return [];
        try {
            var list = JSON.parse(raw);
            return Array.isArray(list) ? list : [];
        } catch (e) {
            console.error('解析測驗紀錄失敗:', e);
            return [];
        }
    }

    /**
     * 儲存歷次模擬測驗紀錄
     */
    function saveExamHistory(list) {
        if (!Array.isArray(list)) list = [];
        // 限制最新 MAX_HISTORY_ITEMS 筆
        list = list.slice(0, MAX_HISTORY_ITEMS);
        storage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(list));
        updateTriggerBadge();
    }

    /**
     * 記錄一筆新的模擬測驗結果
     * @param {Object} result 來自 MockExam 的結算物件
     */
    function recordMockExam(result) {
        if (!result) return;

        var historyList = getExamHistory();
        var now = new Date();

        // 整理錯題簡要資訊 (避免占用過多 storage 容量)
        var wrongList = [];
        if (Array.isArray(result.details)) {
            result.details.forEach(function(item) {
                if (!item.isCorrect) {
                    var wrongItem = {
                        mockIndex: item.mockIndex,
                        bankId: item.bankId,
                        bankName: item.bankName,
                        question: item.question,
                        ansItem: item.ansItem,
                        correctAnswer: item.correctAnswer,
                        userAnswer: item.userAnswer,
                        isAnswered: item.isAnswered,
                        answerMemo: item.answerMemo
                    };
                    wrongList.push(wrongItem);

                    // 同步加入個人錯題本
                    recordWrongQuestion({
                        bankId: item.bankId,
                        bankName: item.bankName,
                        qId: item.bankId + '_' + (item.mockIndex + 1),
                        question: item.question,
                        ansItem: item.ansItem,
                        answer: Array.isArray(item.correctAnswer) ? item.correctAnswer.join(',') : item.correctAnswer,
                        answerMemo: item.answerMemo,
                        userAnswer: item.userAnswer
                    });
                }
            });
        }

        var newRecord = {
            id: 'mock_' + Date.now(),
            timestamp: now.getTime(),
            dateStr: formatDateTime(now),
            score: result.score,
            isPass: result.isPass,
            total: result.total,
            correctCount: result.correctCount,
            wrongCount: result.wrongCount,
            unansweredCount: result.unansweredCount,
            accuracyRate: result.accuracyRate,
            elapsedSeconds: result.elapsedSeconds,
            bankStats: result.bankStats || {},
            wrongQuestions: wrongList
        };

        historyList.unshift(newRecord); // 最新的排在最前方
        saveExamHistory(historyList);
    }

    /**
     * 刪除指定 ID 的單筆測驗紀錄
     */
    function deleteExamRecord(recordId) {
        var list = getExamHistory().filter(function(r) {
            return r.id !== recordId;
        });
        saveExamHistory(list);
        renderCurrentTab();
    }

    /**
     * 清空所有模擬測驗紀錄
     */
    function clearExamHistory() {
        storage.removeItem(STORAGE_KEYS.HISTORY);
        updateTriggerBadge();
        renderCurrentTab();
    }

    /**
     * 取得個人錯題本
     * @returns {Object} 題號識別碼為 key 的字典
     */
    function getWrongNotebook() {
        var raw = storage.getItem(STORAGE_KEYS.WRONG_NOTEBOOK);
        if (!raw) return {};
        try {
            var obj = JSON.parse(raw);
            return (obj && typeof obj === 'object') ? obj : {};
        } catch (e) {
            console.error('解析錯題本失敗:', e);
            return {};
        }
    }

    /**
     * 儲存個人錯題本
     */
    function saveWrongNotebook(notebook) {
        storage.setItem(STORAGE_KEYS.WRONG_NOTEBOOK, JSON.stringify(notebook));
        updateTriggerBadge();
    }

    /**
     * 新增或更新錯題到個人錯題本
     */
    function recordWrongQuestion(qData) {
        if (!qData || !qData.question) return;

        var notebook = getWrongNotebook();
        // 產生唯一識別鍵：考卷ID + 題目文字雜湊或題號
        var qId = qData.qId || (qData.bankId + '_' + qData.question.substring(0, 15));
        var key = (qData.bankId ? (qData.bankId + '::') : '') + qId;

        var now = new Date();
        if (notebook[key]) {
            notebook[key].wrongCount = (notebook[key].wrongCount || 1) + 1;
            notebook[key].lastWrongTime = now.getTime();
            notebook[key].lastWrongDate = formatDateTime(now);
            if (qData.userAnswer) notebook[key].lastUserAnswer = qData.userAnswer;
        } else {
            notebook[key] = {
                key: key,
                bankId: qData.bankId || '',
                bankName: qData.bankName || '綜合題庫',
                qId: qData.qId || '',
                question: qData.question,
                ansItem: qData.ansItem || [],
                answer: qData.answer || '',
                answerMemo: qData.answerMemo || '',
                lastUserAnswer: qData.userAnswer || [],
                wrongCount: 1,
                lastWrongTime: now.getTime(),
                lastWrongDate: formatDateTime(now)
            };
        }

        saveWrongNotebook(notebook);
    }

    /**
     * 從錯題本移除指定題目
     */
    function removeWrongQuestion(key) {
        var notebook = getWrongNotebook();
        if (notebook[key]) {
            delete notebook[key];
            saveWrongNotebook(notebook);
            renderCurrentTab();
        }
    }

    /**
     * 清空錯題本
     */
    function clearWrongNotebook() {
        storage.removeItem(STORAGE_KEYS.WRONG_NOTEBOOK);
        updateTriggerBadge();
        renderCurrentTab();
    }

    /**
     * 儲存循序練習進度 (題號索引)
     */
    function savePracticeProgress(bankId, qIndex) {
        if (!bankId) return;
        var raw = storage.getItem(STORAGE_KEYS.PRACTICE_PROGRESS);
        var progressMap = {};
        if (raw) {
            try { progressMap = JSON.parse(raw) || {}; } catch (e) {}
        }
        progressMap[bankId] = {
            index: qIndex,
            updatedAt: Date.now()
        };
        storage.setItem(STORAGE_KEYS.PRACTICE_PROGRESS, JSON.stringify(progressMap));
    }

    /**
     * 讀取循序練習進度 (題號索引)
     */
    function getPracticeProgress(bankId) {
        if (!bankId) return null;
        var raw = storage.getItem(STORAGE_KEYS.PRACTICE_PROGRESS);
        if (!raw) return null;
        try {
            var progressMap = JSON.parse(raw);
            if (progressMap && progressMap[bankId] && typeof progressMap[bankId].index === 'number') {
                return progressMap[bankId].index;
            }
        } catch (e) {}
        return null;
    }

    /**
     * 匯出全部資料為 JSON 檔案
     */
    function exportBackupData() {
        var data = {
            exportDate: formatDateTime(new Date()),
            version: "1.0",
            examHistory: getExamHistory(),
            wrongNotebook: getWrongNotebook(),
            practiceProgress: (function() {
                try {
                    return JSON.parse(storage.getItem(STORAGE_KEYS.PRACTICE_PROGRESS)) || {};
                } catch (e) {
                    return {};
                }
            })()
        };

        var jsonStr = JSON.stringify(data, null, 2);
        var blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        var nowStr = new Date().toISOString().slice(0, 10);
        a.href = url;
        a.download = 'ExamTraining_測驗紀錄備份_' + nowStr + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * 匯入 JSON 備份資料
     */
    function importBackupData(fileContent) {
        try {
            var data = JSON.parse(fileContent);
            if (!data || typeof data !== 'object') {
                alert('無效的備份檔案格式！');
                return false;
            }

            var importedHistory = 0;
            var importedWrong = 0;

            if (Array.isArray(data.examHistory)) {
                var currentHistory = getExamHistory();
                var idSet = {};
                currentHistory.forEach(function(r) { idSet[r.id] = true; });
                data.examHistory.forEach(function(r) {
                    if (r && r.id && !idSet[r.id]) {
                        currentHistory.push(r);
                        importedHistory++;
                    }
                });
                currentHistory.sort(function(a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });
                saveExamHistory(currentHistory);
            }

            if (data.wrongNotebook && typeof data.wrongNotebook === 'object') {
                var currentNotebook = getWrongNotebook();
                Object.keys(data.wrongNotebook).forEach(function(key) {
                    if (!currentNotebook[key]) {
                        currentNotebook[key] = data.wrongNotebook[key];
                        importedWrong++;
                    }
                });
                saveWrongNotebook(currentNotebook);
            }

            if (data.practiceProgress && typeof data.practiceProgress === 'object') {
                var currentProgress = {};
                try {
                    currentProgress = JSON.parse(storage.getItem(STORAGE_KEYS.PRACTICE_PROGRESS)) || {};
                } catch (e) {}
                Object.keys(data.practiceProgress).forEach(function(k) {
                    currentProgress[k] = data.practiceProgress[k];
                });
                storage.setItem(STORAGE_KEYS.PRACTICE_PROGRESS, JSON.stringify(currentProgress));
            }

            alert('匯入成功！已還原/合併 ' + importedHistory + ' 筆測驗紀錄與 ' + importedWrong + ' 題錯題本。');
            renderCurrentTab();
            return true;
        } catch (e) {
            alert('檔案解析錯誤，請確認檔案格式是否正確: ' + e.message);
            return false;
        }
    }

    /**
     * 清除本機所有測驗相關的 localStorage 紀錄
     */
    function clearAllData() {
        if (confirm('⚠️ 警告：確定要清除所有測驗紀錄、錯題本與練習進度嗎？此動作無法復原！')) {
            storage.removeItem(STORAGE_KEYS.HISTORY);
            storage.removeItem(STORAGE_KEYS.WRONG_NOTEBOOK);
            storage.removeItem(STORAGE_KEYS.PRACTICE_PROGRESS);
            updateTriggerBadge();
            renderCurrentTab();
            alert('已成功清除所有本機測驗資料。');
        }
    }

    /* ==========================================================================
       UI 構建與互動層 (UI & View Layer)
       ========================================================================== */

    /**
     * 更新頂部按鈕徽章 (顯示測驗紀錄次數)
     */
    function updateTriggerBadge() {
        var badge = document.getElementById('historyBadge');
        if (!badge) return;
        var historyCount = getExamHistory().length;
        if (historyCount > 0) {
            badge.innerText = historyCount;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    }

    /**
     * 初始化頂部按鈕與彈窗架構
     */
    function initUI() {
        // 1. 檢查並插入頂部觸發按鈕
        var headerLeft = document.querySelector('.header-left');
        if (headerLeft && !document.getElementById('historyTriggerWrapper')) {
            var wrapper = document.createElement('div');
            wrapper.className = 'history-trigger-wrapper';
            wrapper.id = 'historyTriggerWrapper';
            wrapper.innerHTML = '<button type="button" class="btn-history-trigger" id="btnHistoryTrigger" title="查看測驗歷程、錯題本與成績統計">'
                + '  <span class="history-icon">📊</span>'
                + '  <span class="history-btn-text">紀錄</span>'
                + '  <span class="history-badge" id="historyBadge" style="display: none;">0</span>'
                + '</button>';

            // 插入在樣式按鈕旁邊或 header-left 尾部
            var themeWrapper = document.getElementById('themeSwitchWrapper');
            if (themeWrapper && themeWrapper.nextSibling) {
                headerLeft.insertBefore(wrapper, themeWrapper.nextSibling);
            } else {
                headerLeft.appendChild(wrapper);
            }

            var triggerBtn = wrapper.querySelector('#btnHistoryTrigger');
            if (triggerBtn) {
                triggerBtn.addEventListener('click', function() {
                    openModal('history');
                });
            }
        }

        // 2. 建立彈窗 DOM
        if (!document.getElementById('historyModalOverlay')) {
            var modalOverlay = document.createElement('div');
            modalOverlay.className = 'history-modal-overlay';
            modalOverlay.id = 'historyModalOverlay';
            modalOverlay.innerHTML = '<div class="history-modal" role="dialog" aria-modal="true" aria-labelledby="historyModalTitle">'
                + '  <div class="history-modal-header">'
                + '    <div class="history-modal-title" id="historyModalTitle">'
                + '      <span class="icon">📊</span> 測驗學習紀錄與個人錯題本'
                + '    </div>'
                + '    <button type="button" class="btn-close-modal" id="btnCloseHistoryModal" title="關閉視窗">✕</button>'
                + '  </div>'
                + '  <div class="history-modal-tabs">'
                + '    <button type="button" class="hist-tab-btn active" data-tab="history">🎯 模擬測驗紀錄</button>'
                + '    <button type="button" class="hist-tab-btn" data-tab="wrong">📖 個人錯題本</button>'
                + '    <button type="button" class="hist-tab-btn" data-tab="stats">📈 學習成效統計</button>'
                + '    <button type="button" class="hist-tab-btn" data-tab="backup">💾 備份與管理</button>'
                + '  </div>'
                + '  <div class="history-modal-body" id="historyModalBody"></div>'
                + '</div>';

            document.body.appendChild(modalOverlay);

            // 綁定關閉與遮罩點擊
            var closeBtn = modalOverlay.querySelector('#btnCloseHistoryModal');
            if (closeBtn) {
                closeBtn.addEventListener('click', closeModal);
            }
            modalOverlay.addEventListener('click', function(e) {
                if (e.target === modalOverlay) closeModal();
            });

            // 鍵盤 ESC 關閉
            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape' && modalOverlay.classList.contains('active')) {
                    closeModal();
                }
            });

            // Tab 切換
            modalOverlay.querySelectorAll('.hist-tab-btn').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    var tab = this.getAttribute('data-tab');
                    switchTab(tab);
                });
            });
        }

        updateTriggerBadge();
    }

    /**
     * 開啟紀錄彈窗
     * @param {string} tab 指定開啟的頁籤 ('history' | 'wrong' | 'stats' | 'backup')
     */
    function openModal(tab) {
        var overlay = document.getElementById('historyModalOverlay');
        if (!overlay) {
            initUI();
            overlay = document.getElementById('historyModalOverlay');
        }
        if (!overlay) return;

        overlay.classList.add('active');
        document.body.style.overflow = 'hidden'; // 防止底層滾動
        switchTab(tab || 'history');
    }

    /**
     * 關閉紀錄彈窗
     */
    function closeModal() {
        var overlay = document.getElementById('historyModalOverlay');
        if (overlay) {
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    /**
     * 切換頁籤
     */
    function switchTab(tabId) {
        currentActiveTab = tabId || 'history';
        var overlay = document.getElementById('historyModalOverlay');
        if (!overlay) return;

        overlay.querySelectorAll('.hist-tab-btn').forEach(function(btn) {
            if (btn.getAttribute('data-tab') === currentActiveTab) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        renderCurrentTab();
    }

    /**
     * 渲染當前選取頁籤的內容
     */
    function renderCurrentTab() {
        var body = document.getElementById('historyModalBody');
        if (!body) return;

        switch (currentActiveTab) {
            case 'history':
                renderHistoryTab(body);
                break;
            case 'wrong':
                renderWrongNotebookTab(body);
                break;
            case 'stats':
                renderStatsTab(body);
                break;
            case 'backup':
                renderBackupTab(body);
                break;
            default:
                renderHistoryTab(body);
        }
    }

    /* ==========================================================================
       頁籤 1: 模擬測驗紀錄 (Mock Exam History)
       ========================================================================== */
    function renderHistoryTab(container) {
        var historyList = getExamHistory();

        if (historyList.length === 0) {
            container.innerHTML = '<div class="empty-state-box">'
                + '  <div class="empty-icon">🎯</div>'
                + '  <h3>尚無模擬測驗紀錄</h3>'
                + '  <p>完成模擬測驗並交卷後，系統將自動在此記錄您的成績、耗時與錯題明細！</p>'
                + '  <button type="button" class="btn btn-primary" id="btnGoToMockExam">立即前往模擬測驗</button>'
                + '</div>';

            var btnGo = container.querySelector('#btnGoToMockExam');
            if (btnGo) {
                btnGo.addEventListener('click', function() {
                    closeModal();
                    var btnMock = document.getElementById('btnModeMock');
                    if (btnMock) btnMock.click();
                });
            }
            return;
        }

        // 計算簡易統計
        var totalExams = historyList.length;
        var passedCount = historyList.filter(function(r) { return r.isPass; }).length;
        var avgScore = Math.round(historyList.reduce(function(acc, r) { return acc + (r.score || 0); }, 0) / totalExams);
        var maxScore = Math.max.apply(null, historyList.map(function(r) { return r.score || 0; }));

        var html = '<div class="hist-summary-strip">'
            + '  <div class="hist-stat-item"><span class="lbl">測驗次數</span><span class="val">' + totalExams + ' 次</span></div>'
            + '  <div class="hist-stat-item"><span class="lbl">平均得分</span><span class="val ' + (avgScore >= 70 ? 'text-pass' : 'text-fail') + '">' + avgScore + ' 分</span></div>'
            + '  <div class="hist-stat-item"><span class="lbl">及格率</span><span class="val">' + Math.round((passedCount / totalExams) * 100) + '%</span></div>'
            + '  <div class="hist-stat-item"><span class="lbl">最佳成績</span><span class="val text-pass">' + maxScore + ' 分</span></div>'
            + '</div>'
            + '<div class="hist-toolbar">'
            + '  <span class="toolbar-title">歷次測驗明細 (共 ' + totalExams + ' 次，保留最新 50 筆)</span>'
            + '  <button type="button" class="btn btn-sm btn-outline-danger" id="btnClearHistoryBtn">🗑️ 清空所有成績</button>'
            + '</div>'
            + '<div class="hist-record-list">';

        historyList.forEach(function(rec, idx) {
            var passClass = rec.isPass ? 'badge-pass' : 'badge-fail';
            var passText = rec.isPass ? '✓ 及格' : '✗ 未及格';
            var wrongCount = (rec.wrongQuestions ? rec.wrongQuestions.length : (rec.wrongCount + rec.unansweredCount));

            html += '<div class="hist-record-card" data-record-id="' + rec.id + '">'
                + '  <div class="rec-header">'
                + '    <div class="rec-meta">'
                + '      <span class="rec-date">' + rec.dateStr + '</span>'
                + '      <span class="rec-badge ' + passClass + '">' + passText + '</span>'
                + '    </div>'
                + '    <div class="rec-score-box">'
                + '      <span class="rec-score ' + (rec.isPass ? 'text-pass' : 'text-fail') + '">' + rec.score + '</span><span class="rec-score-unit">分</span>'
                + '    </div>'
                + '  </div>'
                + '  <div class="rec-stats-row">'
                + '    <span>題數：' + rec.total + ' 題</span>'
                + '    <span class="text-pass">答對：' + rec.correctCount + '</span>'
                + '    <span class="text-fail">答錯：' + rec.wrongCount + '</span>'
                + '    <span>耗時：' + formatDuration(rec.elapsedSeconds || 0) + '</span>'
                + '  </div>';

            // 題庫正確率細項
            if (rec.bankStats && Object.keys(rec.bankStats).length > 0) {
                html += '  <div class="rec-bank-pills">';
                Object.keys(rec.bankStats).forEach(function(bid) {
                    var bs = rec.bankStats[bid];
                    var rRate = Math.round((bs.correct / bs.total) * 100);
                    html += '<span class="bank-pill">' + bs.bankName + ': ' + bs.correct + '/' + bs.total + ' (' + rRate + '%)</span>';
                });
                html += '  </div>';
            }

            // 錯題折疊區
            html += '  <div class="rec-actions-row">'
                + '    <button type="button" class="btn btn-sm btn-outline btn-toggle-wrong" data-id="' + rec.id + '">'
                + '      ' + (wrongCount > 0 ? ('🔍 查看錯題 (' + wrongCount + ')') : '✓ 本次全對無錯題')
                + '    </button>'
                + '    <button type="button" class="btn btn-sm btn-ghost-danger btn-delete-rec" data-id="' + rec.id + '" title="刪除此筆">刪除</button>'
                + '  </div>'
                + '  <div class="rec-wrong-drawer" id="wrongDrawer_' + rec.id + '" style="display: none;"></div>'
                + '</div>';
        });

        html += '</div>';
        container.innerHTML = html;

        // 綁定事件
        var btnClear = container.querySelector('#btnClearHistoryBtn');
        if (btnClear) {
            btnClear.addEventListener('click', function() {
                if (confirm('確定要清空所有的模擬測驗成績紀錄嗎？（錯題本將繼續保留）')) {
                    clearExamHistory();
                }
            });
        }

        container.querySelectorAll('.btn-delete-rec').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var id = this.getAttribute('data-id');
                if (confirm('確定要刪除這筆測驗紀錄嗎？')) {
                    deleteExamRecord(id);
                }
            });
        });

        container.querySelectorAll('.btn-toggle-wrong').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var id = this.getAttribute('data-id');
                var drawer = container.querySelector('#wrongDrawer_' + id);
                if (!drawer) return;

                var isVisible = (drawer.style.display === 'block');
                if (isVisible) {
                    drawer.style.display = 'none';
                    this.classList.remove('active');
                } else {
                    drawer.style.display = 'block';
                    this.classList.add('active');
                    renderRecordWrongQuestions(drawer, id);
                }
            });
        });
    }

    /**
     * 渲染單次測驗紀錄內的錯題明細
     */
    function renderRecordWrongQuestions(drawer, recordId) {
        var rec = getExamHistory().find(function(r) { return r.id === recordId; });
        if (!rec || !rec.wrongQuestions || rec.wrongQuestions.length === 0) {
            drawer.innerHTML = '<div class="drawer-empty">太棒了！本次測驗沒有答錯任何題目！</div>';
            return;
        }

        var html = '<div class="drawer-wrong-list">';
        rec.wrongQuestions.forEach(function(q, i) {
            html += '<div class="drawer-wrong-item">'
                + '  <div class="dwi-header">'
                + '    <span class="dwi-badge">' + (q.bankName || '題庫') + ' 第 ' + (q.mockIndex + 1) + ' 題</span>'
                + '    <span class="dwi-status">' + (q.isAnswered ? '答錯' : '未作答') + '</span>'
                + '  </div>'
                + '  <div class="dwi-question">' + q.question + '</div>'
                + '  <div class="dwi-options">';

            if (Array.isArray(q.ansItem)) {
                q.ansItem.forEach(function(opt) {
                    var isCorrect = q.correctAnswer && q.correctAnswer.indexOf(opt.ans) !== -1;
                    var isUser = q.userAnswer && q.userAnswer.indexOf(opt.ans) !== -1;
                    var optClass = '';
                    if (isCorrect) optClass = 'opt-correct';
                    else if (isUser) optClass = 'opt-user-wrong';

                    html += '<div class="dwi-opt ' + optClass + '">'
                        + '  <span class="dwi-opt-key">(' + opt.ans + ')</span> ' + opt.item
                        + (isCorrect ? ' <span class="tag-correct">✓ 正解</span>' : '')
                        + (isUser && !isCorrect ? ' <span class="tag-wrong">✗ 您的作答</span>' : '')
                        + '</div>';
                });
            }

            html += '  </div>';
            if (q.answerMemo && q.answerMemo.trim()) {
                html += '<div class="dwi-memo"><strong>詳解說明：</strong>' + q.answerMemo + '</div>';
            }
            html += '</div>';
        });
        html += '</div>';
        drawer.innerHTML = html;
    }

    /* ==========================================================================
       頁籤 2: 個人錯題本 (Wrong Notebook)
       ========================================================================== */
    function renderWrongNotebookTab(container) {
        var notebook = getWrongNotebook();
        var keys = Object.keys(notebook);

        if (keys.length === 0) {
            container.innerHTML = '<div class="empty-state-box">'
                + '  <div class="empty-icon">📖</div>'
                + '  <h3>錯題本空空如也！</h3>'
                + '  <p>在循序練習或模擬測驗中答錯的題目，會自動收集到這裡，讓您隨時精準複習！</p>'
                + '</div>';
            return;
        }

        // 收集所有考卷分類
        var bankMap = {};
        keys.forEach(function(k) {
            var item = notebook[k];
            var bName = item.bankName || '綜合題庫';
            var bId = item.bankId || 'all';
            bankMap[bId] = bName;
        });

        // 篩選與搜尋
        var filteredList = keys.map(function(k) { return notebook[k]; }).filter(function(item) {
            if (wrongNotebookFilterBank !== 'all' && item.bankId !== wrongNotebookFilterBank) {
                return false;
            }
            if (wrongNotebookSearchKeyword) {
                var kw = wrongNotebookSearchKeyword.toLowerCase();
                var qMatch = (item.question || '').toLowerCase().indexOf(kw) !== -1;
                var memoMatch = (item.answerMemo || '').toLowerCase().indexOf(kw) !== -1;
                return qMatch || memoMatch;
            }
            return true;
        });

        // 依最近答錯時間排序
        filteredList.sort(function(a, b) {
            return (b.lastWrongTime || 0) - (a.lastWrongTime || 0);
        });

        var html = '<div class="notebook-controls">'
            + '  <div class="nc-filters">'
            + '    <div class="select-wrapper">'
            + '      <label for="selectFilterBank" class="select-label">考卷篩選：</label>'
            + '      <select id="selectFilterBank" class="form-select">'
            + '        <option value="all"' + (wrongNotebookFilterBank === 'all' ? ' selected' : '') + '>全部考卷 (' + keys.length + ' 題)</option>';

        Object.keys(bankMap).forEach(function(bId) {
            var count = keys.filter(function(k) { return notebook[k].bankId === bId; }).length;
            html += '<option value="' + bId + '"' + (wrongNotebookFilterBank === bId ? ' selected' : '') + '>' + bankMap[bId] + ' (' + count + ' 題)</option>';
        });

        html += '      </select>'
            + '    </div>'
            + '    <div class="search-wrapper">'
            + '      <input type="text" id="inputSearchWrong" class="form-input" placeholder="🔍 搜尋錯題關鍵字..." value="' + (wrongNotebookSearchKeyword || '') + '">'
            + '    </div>'
            + '  </div>'
            + '  <button type="button" class="btn btn-sm btn-outline-danger" id="btnClearNotebookBtn">🗑️ 清空錯題本</button>'
            + '</div>'
            + '<div class="notebook-list-header">'
            + '  <span>共 ' + filteredList.length + ' 題需加強複習</span>'
            + '</div>'
            + '<div class="notebook-list">';

        if (filteredList.length === 0) {
            html += '<div class="empty-search-box">未找到符合篩選條件的錯題。</div>';
        } else {
            filteredList.forEach(function(q) {
                var correctAnsArr = (q.answer || '').split(',').map(function(s) { return s.trim(); });

                html += '<div class="notebook-card" data-key="' + q.key + '">'
                    + '  <div class="nb-header">'
                    + '    <div class="nb-meta">'
                    + '      <span class="nb-bank-tag">' + (q.bankName || '題庫') + '</span>'
                    + '      <span class="nb-wrong-badge">累計答錯 ' + (q.wrongCount || 1) + ' 次</span>'
                    + '      <span class="nb-date">最後答錯：' + (q.lastWrongDate || '未知') + '</span>'
                    + '    </div>'
                    + '    <button type="button" class="btn btn-sm btn-success-outline btn-remove-wrong" data-key="' + q.key + '" title="已經熟練此題，移出租題本">'
                    + '      ✓ 已精通 (移出)'
                    + '    </button>'
                    + '  </div>'
                    + '  <div class="nb-question">' + q.question + '</div>'
                    + '  <div class="nb-options">';

                if (Array.isArray(q.ansItem)) {
                    q.ansItem.forEach(function(opt) {
                        var isCorrect = correctAnsArr.indexOf(opt.ans) !== -1;
                        html += '<div class="nb-opt ' + (isCorrect ? 'opt-correct' : '') + '">'
                            + '  <span class="nb-opt-idx">(' + opt.ans + ')</span> ' + opt.item
                            + (isCorrect ? ' <span class="tag-correct">✓ 正確答案</span>' : '')
                            + '</div>';
                    });
                }

                html += '  </div>';
                if (q.answerMemo && q.answerMemo.trim()) {
                    html += '<div class="nb-memo"><strong>💡 詳解說明：</strong>' + q.answerMemo + '</div>';
                }
                html += '</div>';
            });
        }

        html += '</div>';
        container.innerHTML = html;

        // 綁定篩選與搜尋事件
        var filterSelect = container.querySelector('#selectFilterBank');
        if (filterSelect) {
            filterSelect.addEventListener('change', function() {
                wrongNotebookFilterBank = this.value;
                renderWrongNotebookTab(container);
            });
        }

        var searchInput = container.querySelector('#inputSearchWrong');
        if (searchInput) {
            searchInput.addEventListener('input', function() {
                wrongNotebookSearchKeyword = this.value;
                renderWrongNotebookTab(container);
            });
        }

        var btnClearNb = container.querySelector('#btnClearNotebookBtn');
        if (btnClearNb) {
            btnClearNb.addEventListener('click', function() {
                if (confirm('確定要清空所有的錯題紀錄嗎？清空後無法復原。')) {
                    clearWrongNotebook();
                }
            });
        }

        container.querySelectorAll('.btn-remove-wrong').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var k = this.getAttribute('data-key');
                removeWrongQuestion(k);
            });
        });
    }

    /* ==========================================================================
       頁籤 3: 學習成效統計 (Statistics)
       ========================================================================== */
    function renderStatsTab(container) {
        var historyList = getExamHistory();
        var notebook = getWrongNotebook();
        var wrongCount = Object.keys(notebook).length;

        var totalExams = historyList.length;
        var passedCount = historyList.filter(function(r) { return r.isPass; }).length;
        var failCount = totalExams - passedCount;
        var passRate = totalExams > 0 ? Math.round((passedCount / totalExams) * 100) : 0;
        var avgScore = totalExams > 0 ? Math.round(historyList.reduce(function(a, b) { return a + (b.score || 0); }, 0) / totalExams) : 0;
        var maxScore = totalExams > 0 ? Math.max.apply(null, historyList.map(function(r) { return r.score || 0; })) : 0;
        var totalQuestionsAnswered = historyList.reduce(function(a, b) { return a + (b.total || 0); }, 0);
        var totalCorrect = historyList.reduce(function(a, b) { return a + (b.correctCount || 0); }, 0);
        var overallAccuracy = totalQuestionsAnswered > 0 ? Math.round((totalCorrect / totalQuestionsAnswered) * 100) : 0;

        // 分數區間統計
        var scoreRanges = { '90+': 0, '80-89': 0, '70-79': 0, '<70': 0 };
        historyList.forEach(function(r) {
            var s = r.score || 0;
            if (s >= 90) scoreRanges['90+']++;
            else if (s >= 80) scoreRanges['80-89']++;
            else if (s >= 70) scoreRanges['70-79']++;
            else scoreRanges['<70']++;
        });

        var html = '<div class="stats-overview-grid">'
            + '  <div class="stats-kpi-card">'
            + '    <div class="kpi-icon">📝</div>'
            + '    <div class="kpi-data">'
            + '      <span class="kpi-val">' + totalExams + ' 次</span>'
            + '      <span class="kpi-lbl">累計模擬測驗次數</span>'
            + '    </div>'
            + '  </div>'
            + '  <div class="stats-kpi-card">'
            + '    <div class="kpi-icon">🎯</div>'
            + '    <div class="kpi-data">'
            + '      <span class="kpi-val ' + (avgScore >= 70 ? 'text-pass' : 'text-fail') + '">' + avgScore + ' 分</span>'
            + '      <span class="kpi-lbl">模擬測驗平均分數</span>'
            + '    </div>'
            + '  </div>'
            + '  <div class="stats-kpi-card">'
            + '    <div class="kpi-icon">🏆</div>'
            + '    <div class="kpi-data">'
            + '      <span class="kpi-val text-pass">' + maxScore + ' 分</span>'
            + '      <span class="kpi-lbl">個人歷史最佳成績</span>'
            + '    </div>'
            + '  </div>'
            + '  <div class="stats-kpi-card">'
            + '    <div class="kpi-icon">📈</div>'
            + '    <div class="kpi-data">'
            + '      <span class="kpi-val">' + passRate + '%</span>'
            + '      <span class="kpi-lbl">及格率 (' + passedCount + '/' + totalExams + ' 及格)</span>'
            + '    </div>'
            + '  </div>'
            + '  <div class="stats-kpi-card">'
            + '    <div class="kpi-icon">🔢</div>'
            + '    <div class="kpi-data">'
            + '      <span class="kpi-val">' + totalQuestionsAnswered + ' 題</span>'
            + '      <span class="kpi-lbl">累計作答試題總數</span>'
            + '    </div>'
            + '  </div>'
            + '  <div class="stats-kpi-card">'
            + '    <div class="kpi-icon">📕</div>'
            + '    <div class="kpi-data">'
            + '      <span class="kpi-val ' + (wrongCount > 0 ? 'text-fail' : 'text-pass') + '">' + wrongCount + ' 題</span>'
            + '      <span class="kpi-lbl">錯題本待複習題數</span>'
            + '    </div>'
            + '  </div>'
            + '</div>';

        // 成績分佈長條圖
        html += '<div class="stats-section-box">'
            + '  <h4>📊 歷次測驗分數分佈</h4>'
            + '  <div class="score-dist-bars">';

        var distLabels = [
            { key: '90+', label: '90 ~ 100 分 (頂尖)', class: 'bar-excellent' },
            { key: '80-89', label: '80 ~ 89 分 (良好)', class: 'bar-good' },
            { key: '70-79', label: '70 ~ 79 分 (及格)', class: 'bar-pass' },
            { key: '<70', label: '70 分以下 (待加強)', class: 'bar-fail' }
        ];

        distLabels.forEach(function(item) {
            var count = scoreRanges[item.key] || 0;
            var pct = totalExams > 0 ? Math.round((count / totalExams) * 100) : 0;
            html += '<div class="dist-row">'
                + '  <div class="dist-lbl">' + item.label + ' (' + count + '次)</div>'
                + '  <div class="dist-track">'
                + '    <div class="dist-fill ' + item.class + '" style="width: ' + pct + '%;"></div>'
                + '  </div>'
                + '  <div class="dist-pct">' + pct + '%</div>'
                + '</div>';
        });

        html += '  </div>'
            + '</div>';

        container.innerHTML = html;
    }

    /* ==========================================================================
       頁籤 4: 備份與管理 (Backup & Manage)
       ========================================================================== */
    function renderBackupTab(container) {
        var historyCount = getExamHistory().length;
        var wrongCount = Object.keys(getWrongNotebook()).length;

        var html = '<div class="backup-section-card">'
            + '  <div class="backup-info-banner">'
            + '    <span class="banner-icon">ℹ️</span>'
            + '    <div>'
            + '      <strong>本機儲存機制說明</strong>'
            + '      <p>本測驗系統所有歷史成績、錯題本與練習進度皆安全存放在您的目前瀏覽器 <code>localStorage</code> 中，無需後端資料庫且完全隱私。若需要更換裝置、使用其他電腦或清理瀏覽器快取，請使用下方的「匯出備份」功能下載存檔。</p>'
            + '    </div>'
            + '  </div>'
            + '  <div class="backup-status-box">'
            + '    <div class="bss-item">現有測驗紀錄：<strong>' + historyCount + '</strong> 筆</div>'
            + '    <div class="bss-item">錯題本收藏：<strong>' + wrongCount + '</strong> 題</div>'
            + '  </div>'
            + '  <div class="backup-actions-grid">'
            + '    <div class="backup-action-box">'
            + '      <h4>📥 備份匯出</h4>'
            + '      <p>將目前所有的測驗紀錄與個人錯題本匯出為 JSON 檔案，妥善保存在您的本機中。</p>'
            + '      <button type="button" class="btn btn-primary" id="btnExportBackup">下載備份檔案 (.json)</button>'
            + '    </div>'
            + '    <div class="backup-action-box">'
            + '      <h4>📤 備份還原 / 合併</h4>'
            + '      <p>從先前匯出的 JSON 備份檔案中讀取並還原或合併測驗歷史與錯題。</p>'
            + '      <input type="file" id="inputImportBackup" accept=".json" style="display: none;">'
            + '      <button type="button" class="btn btn-secondary" id="btnImportBackup">選取備份檔案匯入</button>'
            + '    </div>'
            + '  </div>'
            + '  <div class="danger-zone-box">'
            + '    <h4>⚠️ 資料重設專區</h4>'
            + '    <p>清除本機瀏覽器中保存的所有紀錄（包含歷次成績、個人錯題本與練習題號進度）。</p>'
            + '    <button type="button" class="btn btn-danger" id="btnClearAllDataBtn">徹底清空本機所有測驗資料</button>'
            + '  </div>'
            + '</div>';

        container.innerHTML = html;

        // 匯出按鈕
        var btnExport = container.querySelector('#btnExportBackup');
        if (btnExport) {
            btnExport.addEventListener('click', exportBackupData);
        }

        // 匯入按鈕與檔案選取
        var btnImport = container.querySelector('#btnImportBackup');
        var inputImport = container.querySelector('#inputImportBackup');
        if (btnImport && inputImport) {
            btnImport.addEventListener('click', function() {
                inputImport.value = '';
                inputImport.click();
            });
            inputImport.addEventListener('change', function(e) {
                var file = e.target.files && e.target.files[0];
                if (!file) return;
                var reader = new FileReader();
                reader.onload = function(evt) {
                    var content = evt.target.result;
                    importBackupData(content);
                };
                reader.onerror = function() {
                    alert('讀取檔案失敗！');
                };
                reader.readAsText(file, 'utf-8');
            });
        }

        // 徹底清除按鈕
        var btnClearAll = container.querySelector('#btnClearAllDataBtn');
        if (btnClearAll) {
            btnClearAll.addEventListener('click', clearAllData);
        }
    }

    /**
     * 模組公開介面 (Public API)
     */
    return {
        init: function() {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', initUI);
            } else {
                initUI();
            }
        },
        openModal: openModal,
        closeModal: closeModal,
        recordMockExam: recordMockExam,
        recordWrongQuestion: recordWrongQuestion,
        savePracticeProgress: savePracticeProgress,
        getPracticeProgress: getPracticeProgress,
        getExamHistory: getExamHistory,
        getWrongNotebook: getWrongNotebook,
        exportBackup: exportBackupData,
        importBackup: importBackupData,
        clearAllData: clearAllData
    };
})();

// 自動初始化 (若在瀏覽器環境)
if (typeof window !== 'undefined') {
    window.HistoryManager = HistoryManager;
    HistoryManager.init();
}
