/**
 * ExamReview.js - 考題解答檢視模組
 * 
 * 依據使用者需求規格：
 * 第一列：答案 + 題號 + 題目
 * 第二列：對齊到題號位置開始，依序將選項列在後面
 * 
 * 範本：
 * 【D】 1. 金融從業人員從事保險招攬行為，下列那一項是錯的？ 
 *    (A) 解釋保險商品內容及保單條款 (B) 說明填寫要保書注意事項、轉送要保文件及保險單 (C) 經所屬公司授權從事保險招攬行為 (D) 可以向未經授權公司從事保險招攬行為
 */

var ExamReview = (function() {
    'use strict';

    var state = {
        currentExamId: '113-1',
        questions: [],
        filteredQuestions: [],
        searchKeyword: '',
        currentPage: 1,
        pageSize: 50, // 50 | 100 | 'all'
        viewFormat: 'styled', // 'styled' (精緻對齊排版) | 'plain' (純文字等寬排版)
        highlightAnswer: true, // 是否在選項醒目標註正確解答
        showMemo: true, // 是否顯示詳解
        isInitialized: false
    };

    /**
     * 跳脫 HTML 特殊字元
     */
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * 依照規格格式化單一題目為純文字格式
     * 第一列：答案 + 題號 + 題目 (題目與題號間不用空白)
     * 第二列：對齊到題號位置開始，依序將選項列在後面 (與題號文字完全垂直對齊)
     */
    function formatQuestionPlainText(q) {
        if (!q) return '';
        var ansTag = '【' + (q.answer || '').trim() + '】';
        
        // 1. 題目與題號間不用空白 (例如: 【D】 1.金融從業人員...)
        var line1 = ansTag + ' ' + q.id + '.' + (q.question || '');

        // 2. 答案列對齊到題號 (q.id) 位置：
        // 計算 ansTag + ' ' 的字元視覺寬度 (例如 【D】 加上 1 個半形空格 = 6 個半形空格)
        var prefix = ansTag + ' ';
        var indentWidth = 0;
        for (var i = 0; i < prefix.length; i++) {
            var code = prefix.charCodeAt(i);
            if ((code >= 0x2000 && code <= 0x9fff) || (code >= 0xff00 && code <= 0xffef)) {
                indentWidth += 2;
            } else {
                indentWidth += 1;
            }
        }
        var indentSpaces = ' '.repeat(indentWidth);

        var optionsStr = '';
        if (Array.isArray(q.ansItem)) {
            optionsStr = q.ansItem.map(function(opt) {
                return '(' + opt.ans + ') ' + opt.item;
            }).join(' ');
        }
        var line2 = indentSpaces + optionsStr;

        var text = line1 + '\n' + line2;
        if (state.showMemo && q.answerMemo && q.answerMemo.trim()) {
            text += '\n' + indentSpaces + '💡 詳解：' + q.answerMemo.trim();
        }
        return text;
    }

    /**
     * 複製目前顯示的考題解答純文字到剪貼簿
     */
    function copyAllPlainText() {
        var list = state.filteredQuestions;
        if (!list || list.length === 0) {
            alert('目前沒有可複製的試題。');
            return;
        }

        var fullText = list.map(function(q) {
            return formatQuestionPlainText(q);
        }).join('\n\n');

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(fullText).then(function() {
                showToast('✓ 已複製 ' + list.length + ' 題考題與解答至剪貼簿！');
            }).catch(function() {
                fallbackCopy(fullText);
            });
        } else {
            fallbackCopy(fullText);
        }
    }

    /**
     * 複製文字降級備援
     */
    function fallbackCopy(text) {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        try {
            document.execCommand('copy');
            showToast('✓ 已複製考題與解答至剪貼簿！');
        } catch (e) {
            alert('複製失敗，請手動選取文字複製。');
        }
        document.body.removeChild(ta);
    }

    /**
     * 顯示短暫 Toast 提示
     */
    function showToast(msg) {
        var toast = document.getElementById('reviewToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'reviewToast';
            toast.className = 'review-toast';
            document.body.appendChild(toast);
        }
        toast.innerText = msg;
        toast.classList.add('show');
        setTimeout(function() {
            toast.classList.remove('show');
        }, 2500);
    }

    /**
     * 初始化模組
     */
    function init() {
        if (state.isInitialized) return;
        state.isInitialized = true;

        initControls();
        initContainerUI();

        // 監聽模式切換按鈕
        var btnReview = document.getElementById('btnModeReview');
        if (btnReview) {
            btnReview.addEventListener('click', function() {
                if (typeof window.switchAppMode === 'function') {
                    window.switchAppMode('review');
                }
            });
        }
    }

    /**
     * 當進入「考題解答檢視」模式時被觸發
     */
    function onActivated() {
        // 同步考卷選單
        var curExam = window.currentExam || (typeof getCurrentExamConfig === 'function' ? getCurrentExamConfig() : null);
        var targetId = curExam ? curExam.id : state.currentExamId;

        var reviewYP = document.getElementById('reviewYP');
        if (reviewYP && targetId) {
            reviewYP.value = targetId;
        }

        loadAndRenderExam(targetId);
    }

    /**
     * 初始化頂部控制列
     */
    function initControls() {
        var reviewYP = document.getElementById('reviewYP');
        if (reviewYP) {
            reviewYP.innerHTML = '';
            var list = (typeof examSettings !== 'undefined' && examSettings.exams)
                ? examSettings.exams
                : (window.examConfig || []);

            list.forEach(function(item) {
                var op = document.createElement('option');
                op.value = item.id;
                op.text = item.name;
                reviewYP.appendChild(op);
            });

            reviewYP.addEventListener('change', function() {
                state.currentExamId = this.value;
                state.currentPage = 1;
                loadAndRenderExam(this.value);
            });
        }

        var reviewSearch = document.getElementById('reviewSearch');
        if (reviewSearch) {
            reviewSearch.addEventListener('input', function() {
                state.searchKeyword = this.value.trim().toLowerCase();
                state.currentPage = 1;
                filterAndRender();
            });
        }

        var reviewPageSize = document.getElementById('reviewPageSize');
        if (reviewPageSize) {
            reviewPageSize.addEventListener('change', function() {
                state.pageSize = this.value === 'all' ? 'all' : parseInt(this.value, 10);
                state.currentPage = 1;
                renderQuestionsList();
            });
        }
    }

    /**
     * 初始化主檢視容器
     */
    function initContainerUI() {
        var container = document.getElementById('reviewContainer');
        if (!container) return;

        container.innerHTML = '<div class="review-toolbar">'
            + '  <div class="review-toolbar-left">'
            + '    <div class="review-exam-badge" id="reviewExamTitle">正在載入試卷...</div>'
            + '    <span class="review-count-info" id="reviewCountInfo">共 0 題</span>'
            + '  </div>'
            + '  <div class="review-toolbar-right">'
            + '    <label class="review-toggle-label" title="切換是否醒目標記正確解答">'
            + '      <input type="checkbox" id="chkHighlightAns" checked> 醒目標註正解'
            + '    </label>'
            + '    <label class="review-toggle-label" title="切換是否顯示詳解說明">'
            + '      <input type="checkbox" id="chkShowMemo" checked> 顯示詳解'
            + '    </label>'
            + '    <button type="button" class="btn btn-sm btn-outline" id="btnToggleFormat" title="切換卡片排版與純文字等寬排版">'
            + '      📄 純文字格式'
            + '    </button>'
            + '    <button type="button" class="btn btn-sm btn-primary" id="btnCopyAllText" title="複製目前顯示題目與解答（符合範本格式）">'
            + '      📋 複製純文字'
            + '    </button>'
            + '    <button type="button" class="btn btn-sm btn-secondary" id="btnPrintReview" title="列印或另存 PDF">'
            + '      🖨️ 列印'
            + '    </button>'
            + '  </div>'
            + '</div>'
            + '<div class="review-content-area" id="reviewContentArea"></div>'
            + '<div class="review-pagination-bar" id="reviewPaginationBar"></div>';

        // 綁定工具列事件
        var chkHighlight = container.querySelector('#chkHighlightAns');
        if (chkHighlight) {
            chkHighlight.addEventListener('change', function() {
                state.highlightAnswer = this.checked;
                renderQuestionsList();
            });
        }

        var chkMemo = container.querySelector('#chkShowMemo');
        if (chkMemo) {
            chkMemo.addEventListener('change', function() {
                state.showMemo = this.checked;
                renderQuestionsList();
            });
        }

        var btnFormat = container.querySelector('#btnToggleFormat');
        if (btnFormat) {
            btnFormat.addEventListener('click', function() {
                if (state.viewFormat === 'styled') {
                    state.viewFormat = 'plain';
                    this.innerHTML = '🎨 視覺卡片格式';
                    this.classList.add('active');
                } else {
                    state.viewFormat = 'styled';
                    this.innerHTML = '📄 純文字格式';
                    this.classList.remove('active');
                }
                renderQuestionsList();
            });
        }

        var btnCopy = container.querySelector('#btnCopyAllText');
        if (btnCopy) {
            btnCopy.addEventListener('click', copyAllPlainText);
        }

        var btnPrint = container.querySelector('#btnPrintReview');
        if (btnPrint) {
            btnPrint.addEventListener('click', function() {
                window.print();
            });
        }
    }

    /**
     * 載入並渲染指定考卷
     */
    function loadAndRenderExam(examId) {
        state.currentExamId = examId;

        // 取得考卷設定
        var list = (typeof examSettings !== 'undefined' && examSettings.exams)
            ? examSettings.exams
            : (window.examConfig || []);

        var examItem = list.find(function(item) {
            return item.id.toLowerCase() === examId.toLowerCase();
        }) || list[0];

        if (!examItem) return;

        var titleEl = document.getElementById('reviewExamTitle');
        if (titleEl) titleEl.innerText = examItem.name;

        // 若快取已有，直接讀取
        if (window.bankCache && window.bankCache[examItem.id]) {
            state.questions = window.bankCache[examItem.id].questions || [];
            filterAndRender();
            return;
        }

        // 動態載入題庫
        if (typeof loadExamBank === 'function') {
            var contentArea = document.getElementById('reviewContentArea');
            if (contentArea) contentArea.innerHTML = '<div class="review-loading">正在載入題庫【' + examItem.name + '】...</div>';

            loadExamBank(examItem, function(err, bankData) {
                if (err || !bankData) {
                    if (contentArea) contentArea.innerHTML = '<div class="review-error">無法載入題庫：' + (err ? err.message : '') + '</div>';
                    return;
                }
                state.questions = bankData.questions || [];
                filterAndRender();
            });
        }
    }

    /**
     * 依據關鍵字過濾並重新渲染
     */
    function filterAndRender() {
        if (!state.searchKeyword) {
            state.filteredQuestions = state.questions.slice();
        } else {
            var kw = state.searchKeyword;
            state.filteredQuestions = state.questions.filter(function(q) {
                var qMatch = (q.question || '').toLowerCase().indexOf(kw) !== -1;
                var ansMatch = (q.answer || '').toLowerCase().indexOf(kw) !== -1;
                var memoMatch = (q.answerMemo || '').toLowerCase().indexOf(kw) !== -1;
                var optMatch = false;
                if (Array.isArray(q.ansItem)) {
                    optMatch = q.ansItem.some(function(opt) {
                        return (opt.item || '').toLowerCase().indexOf(kw) !== -1;
                    });
                }
                return qMatch || ansMatch || memoMatch || optMatch;
            });
        }

        var countInfo = document.getElementById('reviewCountInfo');
        if (countInfo) {
            if (state.searchKeyword) {
                countInfo.innerText = '搜尋結果：' + state.filteredQuestions.length + ' / ' + state.questions.length + ' 題';
            } else {
                countInfo.innerText = '共 ' + state.questions.length + ' 題';
            }
        }

        renderQuestionsList();
    }

    /**
     * 渲染題目列表
     */
    function renderQuestionsList() {
        var contentArea = document.getElementById('reviewContentArea');
        if (!contentArea) return;

        var list = state.filteredQuestions;
        if (!list || list.length === 0) {
            contentArea.innerHTML = '<div class="review-empty-box">'
                + '  <div class="empty-icon">🔍</div>'
                + '  <h4>查無相關考題</h4>'
                + '  <p>未找到符合關鍵字「' + escapeHtml(state.searchKeyword) + '」的試題，請嘗試其他關鍵字。</p>'
                + '</div>';
            renderPagination(0, 0);
            return;
        }

        // 分頁切片
        var total = list.length;
        var pSize = state.pageSize === 'all' ? total : state.pageSize;
        var totalPages = Math.ceil(total / pSize);
        if (state.currentPage > totalPages) state.currentPage = totalPages;
        if (state.currentPage < 1) state.currentPage = 1;

        var startIndex = (state.currentPage - 1) * pSize;
        var pageItems = list.slice(startIndex, startIndex + pSize);

        // 依檢視格式分別渲染
        if (state.viewFormat === 'plain') {
            renderPlainTextMode(contentArea, pageItems);
        } else {
            renderStyledMode(contentArea, pageItems);
        }

        renderPagination(totalPages, state.currentPage);
    }

    /**
     * 渲染：視覺卡片排版版 (按使用者要求：第一列答案題號題目，第二列對齊題號依序列出選項)
     */
    function renderStyledMode(container, items) {
        var html = '<div class="review-items-list">';

        items.forEach(function(q) {
            var answerStr = (q.answer || '').trim();
            var correctList = answerStr.split(',').map(function(s) { return s.trim(); });

            // 採用兩欄結構：第 1 欄為【答案】，第 2 欄包含題號題目、選項列、詳解（全部對齊題號且換行自動對齊）
            html += '<div class="review-qa-card" id="rq_' + q.id + '">'
                + '  <div class="qar-badge-col">'
                + '    <span class="qar-ans-badge" title="正確答案">【' + escapeHtml(answerStr) + '】</span>'
                + '  </div>'
                + '  <div class="qar-body-col">'
                + '    <div class="qar-question-row">'
                + '      <div class="qar-question-content">'
                + '        <span class="qar-qno">' + q.id + '.</span><span class="qar-question">' + escapeHtml(q.question) + '</span>'
                + '      </div>'
                + '      <button type="button" class="btn-fav-wrong" data-qid="' + q.id + '" title="加入個人錯題本">⭐ 收藏</button>'
                + '    </div>'
                + '    <div class="qar-options-flow">';

            if (Array.isArray(q.ansItem)) {
                q.ansItem.forEach(function(opt) {
                    var isCorrect = correctList.indexOf(opt.ans) !== -1;
                    var optClass = (state.highlightAnswer && isCorrect) ? 'qar-opt-item qar-opt-target' : 'qar-opt-item';

                    html += '<span class="' + optClass + '">'
                        + '  <span class="opt-label">(' + escapeHtml(opt.ans) + ')</span>'
                        + '  <span class="opt-text">' + escapeHtml(opt.item) + '</span>'
                        + '</span>';
                });
            }

            html += '    </div>';

            // 第三列（可選詳解說明，同樣位於第二欄，與題目和答案列垂直對齊）
            if (state.showMemo && q.answerMemo && q.answerMemo.trim()) {
                html += '    <div class="qar-memo-box">'
                    + '      <strong>💡 詳解說明：</strong>' + escapeHtml(q.answerMemo.trim())
                    + '    </div>';
            }

            html += '  </div>'
                + '</div>';
        });

        html += '</div>';
        container.innerHTML = html;

        // 綁定快速收藏錯題事件
        container.querySelectorAll('.btn-fav-wrong').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var qid = parseInt(this.getAttribute('data-qid'), 10);
                var targetQ = state.questions.find(function(q) { return q.id === qid; });
                if (targetQ && window.HistoryManager && typeof window.HistoryManager.recordWrongQuestion === 'function') {
                    window.HistoryManager.recordWrongQuestion({
                        bankId: state.currentExamId,
                        bankName: document.getElementById('reviewExamTitle') ? document.getElementById('reviewExamTitle').innerText : '考題檢視',
                        qId: targetQ.id,
                        question: targetQ.question,
                        ansItem: targetQ.ansItem,
                        answer: targetQ.answer,
                        answerMemo: targetQ.answerMemo
                    });
                    this.innerText = '✓ 已收藏';
                    this.classList.add('faved');
                    showToast('✓ 已將第 ' + targetQ.id + ' 題加入個人錯題本！');
                }
            });
        });
    }

    /**
     * 渲染：純文字等寬格式排版 (完全符合使用者範本文字字元排版，換行保持對齊)
     */
    function renderPlainTextMode(container, items) {
        var html = '<div class="review-plaintext-wrapper">'
            + '  <div class="plaintext-header">'
            + '    <span>📋 純文字格式預覽（等寬字體、換行自動對齊題號）</span>'
            + '    <button type="button" class="btn btn-sm btn-primary" id="btnCopyInPlainMode" title="複製目前顯示題目與解答（符合範本格式）">'
            + '      📋 複製純文字'
            + '    </button>'
            + '  </div>'
            + '  <div class="plaintext-body">';

        items.forEach(function(q) {
            var answerStr = (q.answer || '').trim();
            var optionsStr = '';
            if (Array.isArray(q.ansItem)) {
                optionsStr = q.ansItem.map(function(opt) {
                    return '(' + opt.ans + ') ' + opt.item;
                }).join(' ');
            }

            html += '<div class="pt-item-block" id="pt_' + q.id + '">'
                + '  <div class="pt-badge-col">【' + escapeHtml(answerStr) + '】</div>'
                + '  <div class="pt-body-col">'
                + '    <div class="pt-line pt-qline">' + q.id + '.' + escapeHtml(q.question) + '</div>'
                + '    <div class="pt-line pt-ansline">' + escapeHtml(optionsStr) + '</div>';

            if (state.showMemo && q.answerMemo && q.answerMemo.trim()) {
                html += '    <div class="pt-line pt-memoline">💡 詳解：' + escapeHtml(q.answerMemo.trim()) + '</div>';
            }

            html += '  </div>'
                + '</div>';
        });

        html += '  </div>'
            + '</div>';

        container.innerHTML = html;

        var btnCopy = container.querySelector('#btnCopyInPlainMode');
        if (btnCopy) {
            btnCopy.addEventListener('click', copyAllPlainText);
        }
    }

    /**
     * 渲染分頁列
     */
    function renderPagination(totalPages, currentPage) {
        var bar = document.getElementById('reviewPaginationBar');
        if (!bar) return;

        if (totalPages <= 1) {
            bar.innerHTML = '';
            bar.style.display = 'none';
            return;
        }

        bar.style.display = 'flex';
        var html = '<div class="pagination-controls">'
            + '  <button type="button" class="btn btn-sm btn-secondary" id="btnRevPrevPage"' + (currentPage <= 1 ? ' disabled' : '') + '>← 上一頁</button>'
            + '  <span class="page-indicator">第 ' + currentPage + ' / ' + totalPages + ' 頁</span>'
            + '  <button type="button" class="btn btn-sm btn-secondary" id="btnRevNextPage"' + (currentPage >= totalPages ? ' disabled' : '') + '>下一頁 →</button>'
            + '  <div class="page-jump-box">'
            + '    <label for="selectJumpPage" class="jump-lbl">跳至：</label>'
            + '    <select id="selectJumpPage" class="form-select form-select-sm">';

        for (var i = 1; i <= totalPages; i++) {
            html += '<option value="' + i + '"' + (i === currentPage ? ' selected' : '') + '>第 ' + i + ' 頁</option>';
        }

        html += '    </select>'
            + '  </div>'
            + '</div>';

        bar.innerHTML = html;

        var btnPrev = bar.querySelector('#btnRevPrevPage');
        if (btnPrev) {
            btnPrev.addEventListener('click', function() {
                if (state.currentPage > 1) {
                    state.currentPage--;
                    renderQuestionsList();
                    scrollToTop();
                }
            });
        }

        var btnNext = bar.querySelector('#btnRevNextPage');
        if (btnNext) {
            btnNext.addEventListener('click', function() {
                if (state.currentPage < totalPages) {
                    state.currentPage++;
                    renderQuestionsList();
                    scrollToTop();
                }
            });
        }

        var selectJump = bar.querySelector('#selectJumpPage');
        if (selectJump) {
            selectJump.addEventListener('change', function() {
                state.currentPage = parseInt(this.value, 10);
                renderQuestionsList();
                scrollToTop();
            });
        }
    }

    /**
     * 滾動至考題頂部
     */
    function scrollToTop() {
        var container = document.getElementById('reviewContainer');
        if (container) {
            container.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    /**
     * 取得單題之解答檢視格式字串 (供其他模組呼叫)
     */
    function getSingleQuestionReviewHtml(q) {
        if (!q) return '';
        var answerStr = (q.answer || '').trim();
        var correctList = answerStr.split(',').map(function(s) { return s.trim(); });

        var html = '<div class="review-qa-card review-single-preview">'
            + '  <div class="qar-badge-col">'
            + '    <span class="qar-ans-badge">【' + escapeHtml(answerStr) + '】</span>'
            + '  </div>'
            + '  <div class="qar-body-col">'
            + '    <div class="qar-question-row">'
            + '      <div class="qar-question-content">'
            + '        <span class="qar-qno">' + q.id + '.</span><span class="qar-question">' + escapeHtml(q.question) + '</span>'
            + '      </div>'
            + '    </div>'
            + '    <div class="qar-options-flow">';

        if (Array.isArray(q.ansItem)) {
            q.ansItem.forEach(function(opt) {
                var isCorrect = correctList.indexOf(opt.ans) !== -1;
                html += '<span class="qar-opt-item ' + (isCorrect ? 'qar-opt-target' : '') + '">'
                    + '  <span class="opt-label">(' + escapeHtml(opt.ans) + ')</span>'
                    + '  <span class="opt-text">' + escapeHtml(opt.item) + '</span>'
                    + '</span>';
            });
        }

        html += '    </div>';

        if (q.answerMemo && q.answerMemo.trim()) {
            html += '    <div class="qar-memo-box"><strong>💡 詳解說明：</strong>' + escapeHtml(q.answerMemo.trim()) + '</div>';
        }

        html += '  </div>'
            + '</div>';
        return html;
    }

    return {
        init: init,
        onActivated: onActivated,
        loadAndRenderExam: loadAndRenderExam,
        copyAllPlainText: copyAllPlainText,
        formatQuestionPlainText: formatQuestionPlainText,
        getSingleQuestionReviewHtml: getSingleQuestionReviewHtml
    };
})();

// 自動初始化 (若在瀏覽器環境)
if (typeof window !== 'undefined') {
    window.ExamReview = ExamReview;
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ExamReview.init);
    } else {
        ExamReview.init();
    }
}
