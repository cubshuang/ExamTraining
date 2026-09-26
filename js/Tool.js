/**
 * Tool.js - 通用工具函式與動態題庫載入器
 */

/**
 * 取得網址 Query 參數
 * @param {string} param 參數名稱
 * @returns {string} 參數值
 */
function request(param) {
    if (typeof URLSearchParams !== "undefined") {
        var params = new URLSearchParams(window.location.search);
        var val = params.get(param);
        if (val !== null) return val;
        // 忽略大小寫搜尋
        for (var entry of params.entries()) {
            if (entry[0].toLowerCase() === param.toLowerCase()) {
                return entry[1];
            }
        }
    }
    // 降級處理：自網址字串解析
    var url = location.href;
    var qIndex = url.indexOf("?");
    if (qIndex === -1) return "";
    var paraString = url.substring(qIndex + 1).split("&");
    for (var i = 0; i < paraString.length; i++) {
        var item = paraString[i];
        if (!item) continue;
        var eqIndex = item.indexOf("=");
        var key = eqIndex > -1 ? item.substring(0, eqIndex) : item;
        var val = eqIndex > -1 ? item.substring(eqIndex + 1) : "";
        if (key.toLowerCase() === param.toLowerCase()) {
            return decodeURIComponent(val);
        }
    }
    return "";
}

/**
 * 動態載入 JavaScript 腳本（採用事件監聽，杜絕 setTimeout 延遲）
 * @param {string} src 腳本路徑
 * @param {Function} onload 載入成功回呼
 * @param {Function} onerror 載入失敗回呼
 */
function loadScript(src, onload, onerror) {
    var head = document.getElementsByTagName('head')[0] || document.documentElement;
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = src;
    script.onload = function() {
        if (typeof onload === "function") onload();
    };
    script.onerror = function(err) {
        console.error("無法載入腳本: " + src, err);
        if (typeof onerror === "function") onerror(src, err);
    };
    head.appendChild(script);
}

/**
 * 依據網址參數或預設值取得當前考卷設定
 * @returns {Object|null} 當前考卷設定物件 {id, name, file}
 */
function getCurrentExamConfig() {
    var list = (typeof examSettings !== "undefined" && examSettings.exams)
        ? examSettings.exams
        : (window.examConfig || []);

    if (!list || list.length === 0) {
        return null;
    }

    // 支援參數：?exam=113-1 或 ?id=113-1，並相容舊版 ?y=113&p=1
    var examParam = request("exam") || request("id");
    if (!examParam) {
        var y = request("y");
        var p = request("p");
        if (y && p) {
            examParam = y + "-" + p;
        } else if (y) {
            examParam = y;
        }
    }

    if (examParam) {
        for (var i = 0; i < list.length; i++) {
            if (list[i].id.toLowerCase() === examParam.toLowerCase()) {
                return list[i];
            }
        }
    }

    // 若未指定或未匹配，使用預設 defaultExamId 或清單第一筆
    var defaultId = (typeof examSettings !== "undefined" && examSettings.defaultExamId)
        ? examSettings.defaultExamId
        : list[0].id;

    for (var j = 0; j < list.length; j++) {
        if (list[j].id.toLowerCase() === defaultId.toLowerCase()) {
            return list[j];
        }
    }

    return list[0];
}

// 題庫資料快取 (避免重複載入與變數污染)
window.bankCache = window.bankCache || {};

/**
 * 動態載入單一題庫資料檔並快取隔離
 * @param {Object} examItem 考卷設定 {id, name, file}
 * @param {Function} callback (err, bankData) 回呼函式
 */
function loadExamBank(examItem, callback) {
    if (!examItem || !examItem.id) {
        if (typeof callback === "function") callback(new Error("未提供考卷設定"));
        return;
    }
    if (window.bankCache[examItem.id]) {
        if (typeof callback === "function") callback(null, window.bankCache[examItem.id]);
        return;
    }
    // 清空暫存全域變數，避免讀取到上一份考卷
    window.exam = undefined;
    window.examName = undefined;

    loadScript(examItem.file, function() {
        if (window.exam) {
            var bankData = {
                id: examItem.id,
                name: window.examName || examItem.name,
                file: examItem.file,
                questions: window.exam.slice()
            };
            window.bankCache[examItem.id] = bankData;
            if (typeof callback === "function") callback(null, bankData);
        } else {
            var err = new Error("題庫載入完成但未取得題目陣列: " + examItem.name);
            console.error(err);
            if (typeof callback === "function") callback(err);
        }
    }, function(src, err) {
        if (typeof callback === "function") callback(err || new Error("載入腳本失敗: " + src));
    });
}

/**
 * 批次循序載入多個題庫資料檔（防範全域變數同名覆蓋衝突）
 * @param {Array} examItems 考卷設定陣列
 * @param {Function} onProgress (current, total, item)
 * @param {Function} onComplete (err, resultsMap)
 */
function loadMultipleExamBanks(examItems, onProgress, onComplete) {
    var results = {};
    if (!examItems || examItems.length === 0) {
        if (typeof onComplete === "function") onComplete(null, results);
        return;
    }
    var index = 0;
    function next() {
        if (index >= examItems.length) {
            if (typeof onComplete === "function") onComplete(null, results);
            return;
        }
        var item = examItems[index];
        if (typeof onProgress === "function") {
            onProgress(index + 1, examItems.length, item);
        }
        loadExamBank(item, function(err, bankData) {
            if (!err && bankData) {
                results[item.id] = bankData;
            } else {
                console.warn("載入題庫警告: ", item.name, err);
            }
            index++;
            next();
        });
    }
    next();
}

// 執行題庫與核心腳本載入流程
(function initApp() {
    // 載入並初始化外觀主題管理器
    if (typeof ThemeManager !== "undefined" && typeof ThemeManager.init === "function") {
        ThemeManager.init();
    } else {
        loadScript("js/ThemeManager.js", function() {
            if (window.ThemeManager && typeof window.ThemeManager.init === "function") {
                window.ThemeManager.init();
            }
        });
    }

    // 載入並初始化測驗歷程管理器
    if (typeof HistoryManager !== "undefined" && typeof HistoryManager.init === "function") {
        HistoryManager.init();
    } else {
        loadScript("js/HistoryManager.js", function() {
            if (window.HistoryManager && typeof window.HistoryManager.init === "function") {
                window.HistoryManager.init();
            }
        });
    }

    var currentExam = getCurrentExamConfig();
    window.currentExam = currentExam;

    if (currentExam && currentExam.file) {
        // 1. 動態載入指定的考卷題庫
        loadExamBank(currentExam, function(err, bankData) {
            if (err) {
                var ret = document.querySelector("#dvAnsRet");
                if (ret) ret.innerText = "無法載入題庫資料檔案: " + err.message;
                return;
            }
            // 保持 window.exam 與 window.examName 指向當前考卷
            window.exam = bankData.questions;
            window.examName = bankData.name;

            // 2. 題庫載入成功後依序載入 QA.js 與 MockExam.js
            loadScript("js/QA.js", function() {
                loadScript("js/MockExam.js", function() {
                    if (window.MockExam && typeof window.MockExam.init === "function") {
                        window.MockExam.init();
                    }
                }, function(src) {
                    console.warn("未載入 MockExam.js 或載入失敗: " + src);
                });
            }, function(src) {
                var ret = document.querySelector("#dvAnsRet");
                if (ret) ret.innerText = "無法載入測驗互動核心 (QA.js)";
            });
        });
    } else {
        console.error("未找到任何考卷設定，請檢查 js/config.js");
        var ret = document.querySelector("#dvAnsRet");
        if (ret) ret.innerText = "未找到考卷設定，請檢查 js/config.js";
    }
})();
