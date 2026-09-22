/**
 * QA.js - 測驗互動核心邏輯
 */

let dvSol = document.querySelector("#dvAnsSol");
let dvRet = document.querySelector("#dvAnsRet");
var examName = (typeof window !== "undefined" && window.examName) ? window.examName : "金融從業人員考題";
window.examName = examName;

var nowQues = {
    isMulti: false,
    btnType: '',
    myAns: '',
    myPreAns: '',
    QNo: 0,
    selNo: -1,
    cleanQA: function() {
        if (dvSol) {
            dvSol.innerHTML = "";
            dvSol.className = "";
        }
        if (dvRet) {
            dvRet.innerHTML = "";
            dvRet.className = "";
        }
        document.querySelectorAll(".ansItem").forEach(item => {
            item.classList.remove("ansCorrect", "ansWrong");
        });
    },
    selectAns: function() {
        let QAlist = Array.from(document.querySelectorAll(".QAItem"));
        this.myAns = QAlist.map(item => (item.checked) ? item.id.split('_')[1] : '').filter(ans => ans !== '');
        QAlist.forEach(item => {
            let id = item.id.split('_')[1];
            let aItem = document.querySelector("#ansItem_" + id);
            if (aItem) {
                if (item.checked) {
                    aItem.classList.add("ansSelect");
                } else {
                    aItem.classList.remove("ansSelect");
                }
            }
        });
        this.myPreAns = nowQues.myAns;
        this.cleanQA();
    },
    errGetQA: function() {
        if (dvSol) {
            dvSol.innerHTML = "";
            dvSol.className = "";
        }
        if (dvRet) {
            dvRet.className = "ret-badge ret-wrong";
            dvRet.innerHTML = "取得題目有誤";
        }
    }
};

var QA = {
    arrQues: null,
    yourAns: null,
    getQuestion: function(num) {
        try {
            nowQues.cleanQA();
            nowQues.QNo = arrQues.indexOf(num);
            if (nowQues.QNo < 0) nowQues.QNo = 0;
            let Question = exam[nowQues.QNo];
            if (!Question) {
                nowQues.errGetQA();
                return;
            }
            let Answer = Question.ansItem;
            let QId = Question.id;
            nowQues.isMulti = (Question.answer.indexOf(',') > 0);
            nowQues.btnType = (nowQues.isMulti) ? "checkbox" : "radio";
            nowQues.selNo = -1;

            // 標題渲染
            document.title = examName + " - 第 " + QId + " 題";
            let qNameEl = document.querySelector(".dvQName");
            if (qNameEl) qNameEl.innerHTML = examName;

            // 題號與類型 Badge 渲染
            let qNoEl = document.querySelector(".dvQNo");
            if (qNoEl) {
                let typeBadge = nowQues.isMulti
                    ? "<span class='badge badge-multi'>複選題</span>"
                    : "<span class='badge badge-single'>單選題</span>";
                let progressText = "<span class='progress-info'>第 " + QId + " / " + exam.length + " 題</span>";
                qNoEl.innerHTML = typeBadge + progressText;
            }

            // 題目內文渲染
            let quesEl = document.querySelector(".dvQues");
            if (quesEl) quesEl.innerHTML = Question.question;

            // 同步更新題號下拉選單
            let qaNoSelect = document.querySelector("#qaNo");
            if (qaNoSelect) {
                qaNoSelect.value = QId;
            }

            // 選項渲染
            let ansArea = document.querySelector(".dvAns");
            ansArea.innerHTML = "";
            for (let i = 0; i < Answer.length; i++) {
                let AId = Answer[i].ans;
                let ansDiv = document.createElement("div");
                ansDiv.className = "ansItem-wrapper";
                ansDiv.innerHTML = "<div class='ansItem' id='ansItem_" + AId + "'>"
                    + "<input type='" + nowQues.btnType + "' id='A_" + AId + "' name='Q_" + QId + "' class='QAItem'>"
                    + "<span class='ansBadge'>" + AId + "</span>"
                    + "<div class='ansCont' id='C_" + AId + "'>" + Answer[i].item + "</div>"
                    + "</div>";
                ansArea.appendChild(ansDiv);
            }

            // 事件綁定：點選卡片任一處即可選取
            document.querySelectorAll(".ansItem").forEach(item => {
                item.addEventListener("click", function(e) {
                    if (e.target && e.target.classList.contains("QAItem")) return;
                    let id = this.id.split("_")[1];
                    let input = document.querySelector("#A_" + id);
                    if (input) {
                        input.checked = (nowQues.btnType === "checkbox") ? !(input.checked) : true;
                        nowQues.selectAns();
                    }
                });
            });

            document.querySelectorAll(".QAItem").forEach(item => {
                item.addEventListener("change", this.checkedMe);
            });
        } catch (e) {
            console.error("載入題目失敗:", e);
        }
    },

    // 依據考卷 ID 切換網址
    getQuestionYearNo: function(examId) {
        try {
            if (typeof URLSearchParams !== "undefined") {
                var searchParams = new URLSearchParams(window.location.search);
                searchParams.set("exam", examId);
                searchParams.delete("y");
                searchParams.delete("p");
                location.href = location.pathname + "?" + searchParams.toString();
            } else {
                location.href = location.pathname + "?exam=" + encodeURIComponent(examId);
            }
        } catch (e) {
            location.href = location.pathname + "?exam=" + encodeURIComponent(examId);
        }
    },

    // 選項勾選狀態變更
    checkedMe: function() {
        nowQues.cleanQA();
        nowQues.selectAns();
    },

    // 鍵盤上下箭頭移動選項
    selectMe: function(m) {
        let QAlist = document.querySelectorAll(".QAItem");
        if (!QAlist || QAlist.length === 0) return;

        switch (nowQues.btnType) {
            case "radio":
                let nowChoice = Array.from(QAlist).map(item => item.checked).indexOf(true);
                if (nowChoice < 0) {
                    nowChoice = (m > 0) ? 0 : QAlist.length - 1;
                } else {
                    if ((m > 0 && nowChoice < QAlist.length - 1) || (m < 0 && nowChoice > 0)) {
                        nowChoice = nowChoice + m;
                    }
                }
                QAlist[nowChoice].checked = true;
                nowQues.selNo = nowChoice;
                break;
            case "checkbox":
                let nowSelect = nowQues.selNo;
                if (nowSelect < 0) {
                    nowSelect = (m > 0) ? 0 : QAlist.length - 1;
                } else {
                    if ((m > 0 && nowSelect < QAlist.length - 1) || (m < 0 && nowSelect > 0)) {
                        nowSelect = nowSelect + m;
                    }
                }
                nowQues.selNo = nowSelect;
                let allAnsItems = document.querySelectorAll(".ansItem");
                for (let i = 0; i < allAnsItems.length; i++) {
                    if (i === nowQues.selNo) {
                        allAnsItems[i].classList.add("ansToSelect");
                    } else {
                        allAnsItems[i].classList.remove("ansToSelect");
                    }
                }
                break;
        }
        nowQues.selectAns();
    },

    // 鍵盤切換選取狀態
    selectMe2: function() {
        let QAlist = document.querySelectorAll(".QAItem");
        try {
            if (QAlist[nowQues.selNo]) {
                QAlist[nowQues.selNo].checked = !(QAlist[nowQues.selNo].checked);
            }
        } catch (error) {
            console.error(error);
        }
        nowQues.selectAns();
    },

    // 查看答案
    fnWatchAns: function() {
        if (!exam || !exam[nowQues.QNo]) return;
        let thisAns = exam[nowQues.QNo].answer.split(',');

        // 清除舊的答案高亮
        document.querySelectorAll(".ansItem").forEach(item => {
            item.classList.remove("ansCorrect", "ansWrong");
        });

        if (nowQues.myAns.length > 0) {
            let isCorrect = (nowQues.myAns.join(',') === thisAns.join(','));
            if (dvRet) {
                dvRet.className = isCorrect ? "ret-badge ret-correct" : "ret-badge ret-wrong";
                dvRet.innerHTML = isCorrect
                    ? "<span style='font-size:1.2rem;'>✓</span> 恭喜答對！"
                    : "<span style='font-size:1.2rem;'>✗</span> 答案錯誤！";
            }
            if (dvSol) {
                dvSol.className = "sol-box";
                let solHtml = "<div class='sol-title'><strong>正確答案：</strong><span class='sol-ans-text'>" + thisAns.join('、') + "</span></div>";
                if (exam[nowQues.QNo].answerMemo != null && exam[nowQues.QNo].answerMemo.trim() !== "") {
                    solHtml += "<div class='sol-memo'><span class='memo-tag'>詳解說明</span> " + exam[nowQues.QNo].answerMemo + "</div>";
                }
                dvSol.innerHTML = solHtml;
            }

            // 正確答案加上綠色高亮
            thisAns.forEach(id => {
                let correctItem = document.querySelector("#ansItem_" + id);
                if (correctItem) correctItem.classList.add("ansCorrect");
            });

            // 若答錯，把使用者選錯的項目標註紅色高亮
            if (!isCorrect) {
                nowQues.myAns.forEach(id => {
                    if (!thisAns.includes(id)) {
                        let wrongItem = document.querySelector("#ansItem_" + id);
                        if (wrongItem) wrongItem.classList.add("ansWrong");
                    }
                });
            }
        } else {
            if (dvSol) {
                dvSol.innerHTML = "";
                dvSol.className = "";
            }
            if (dvRet) {
                dvRet.className = "ret-badge ret-warning";
                dvRet.innerHTML = "⚠️ 請先選擇您的答案再查看結果";
            }
        }
    },

    // 下一題
    fnQNext: function() {
        (nowQues.QNo < arrQues.length - 1) ? QA.getQuestion(arrQues[nowQues.QNo + 1]) : nowQues.errGetQA();
    },

    // 上一題
    fnQPrevios: function() {
        (nowQues.QNo > 0) ? QA.getQuestion(arrQues[nowQues.QNo - 1]) : nowQues.errGetQA();
    },
    fnQPrevious: function() {
        this.fnQPrevios();
    },

    // 題號下拉選單變更
    selectQANo: function() {
        let val = document.querySelector("#qaNo").value;
        QA.getQuestion(val * 1.0);
    },

    // 考卷下拉選單變更
    selectQAYP: function() {
        let selector = (typeof examSettings !== "undefined" && examSettings.selector) ? examSettings.selector : "#qaYP";
        let target = document.querySelector(selector);
        if (target) {
            QA.getQuestionYearNo(target.value);
        }
    },

    // 初始化測驗介面
    ini: function() {
        dvSol = document.querySelector("#dvAnsSol");
        dvRet = document.querySelector("#dvAnsRet");

        yourAns = [];
        arrQues = [];

        // 1. 初始化題號下拉選單
        let qaNoSelect = document.querySelector("#qaNo");
        try {
            if (qaNoSelect && typeof exam !== "undefined") {
                qaNoSelect.innerHTML = "";
                for (let i = 0; i < exam.length; i++) {
                    arrQues[i] = exam[i].id;
                    let op = document.createElement("option");
                    op.value = arrQues[i];
                    op.text = "第 " + (i + 1).toString() + " 題";
                    qaNoSelect.appendChild(op);
                }
                yourAns.length = exam.length;
                this.getQuestion(arrQues[0]);

                document.querySelector("#AnsWatch").addEventListener("click", this.fnWatchAns);
                document.querySelector("#QNext").addEventListener("click", this.fnQNext);
                document.querySelector("#QPrevious").addEventListener("click", this.fnQPrevios);
                qaNoSelect.addEventListener("change", this.selectQANo);
            }
        } catch (e) {
            console.error("初始化題號失敗:", e);
            if (dvRet) dvRet.innerHTML = e.toString();
        }

        // 2. 初始化考卷選單
        let selector = (typeof examSettings !== "undefined" && examSettings.selector) ? examSettings.selector : "#qaYP";
        let qaYPSelect = document.querySelector(selector);
        try {
            if (qaYPSelect) {
                qaYPSelect.innerHTML = "";
                let examsList = (typeof examSettings !== "undefined" && examSettings.exams)
                    ? examSettings.exams
                    : (window.examConfig || []);

                for (let i = 0; i < examsList.length; i++) {
                    let item = examsList[i];
                    let op = document.createElement("option");
                    op.value = item.id;
                    op.text = item.name;
                    qaYPSelect.appendChild(op);
                }
                qaYPSelect.addEventListener("change", this.selectQAYP);

                if (window.currentExam && window.currentExam.id) {
                    qaYPSelect.value = window.currentExam.id;
                }
            }
        } catch (e) {
            console.error("初始化考卷選單失敗:", e);
            if (dvRet) dvRet.innerHTML = e.toString();
        }
    }
};

// 立即初始化測驗介面
QA.ini();

// 綁定鍵盤快速鍵
window.addEventListener('keydown', function(e) {
    var key = e.keyCode || e.which;
    switch (key) {
        case 37: // 左箭頭：上一題
            QA.fnQPrevios();
            break;
        case 39: // 右箭頭：下一題
            QA.fnQNext();
            break;
        case 13: // Enter：看答案
            QA.fnWatchAns();
            break;
        case 38: // 上箭頭：上一個選項 (防止滾動)
            e.preventDefault();
            QA.selectMe(-1);
            break;
        case 40: // 下箭頭：下一個選項 (防止滾動)
            e.preventDefault();
            QA.selectMe(1);
            break;
        case 32: // 空白鍵 (防止滾動並切換選取)
            e.preventDefault();
            QA.selectMe2();
            break;
        case 17: // Ctrl
        case 18: // Alt
            QA.selectMe2();
            break;
    }
});
