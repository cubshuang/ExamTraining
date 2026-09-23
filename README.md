# ExamTraining 自我測驗系統

ExamTraining 是一個使用 HTML + JavaScript + CSS 所建構的純靜態自我測驗網頁工具，無需後端伺服器與資料庫，直接以瀏覽器開啟 `index.html` 即可使用。

---

## 專案目錄結構

```text
ExamTraining/
├── index.html               # 測驗主畫面（入口網頁，支援雙模式與樣式自訂）
├── README.md                # 專案說明與操作指南
├── css/
│   └── QA.css               # 現代化響應式 UI 樣式表（含 5 套主題、字體縮放、暗黑護眼）
├── js/
│   ├── config.js            # 考卷、模擬測驗與 UI 主題預設參數設定檔
│   ├── Tool.js              # 工具函式、多題庫動態隔離載入器
│   ├── QA.js                # 循序練習模式核心互動邏輯與鍵盤事件
│   ├── MockExam.js          # 模擬試題測驗模組 (隨機抽題、計時評分與解析)
│   └── ThemeManager.js      # UI 多樣式管理器 (主題切換、字體排版、偏好記憶)
└── data/
    ├── Exam-113-1.js        # 113 年金融市場常識題庫 (616 題)
    └── Exam-113-2.js        # 113 年職業道德題庫 (504 題)
```

---

## 考卷與外觀參數設定 (`js/config.js`)

系統所有考卷選單、模擬測驗預設配題及初次開啟時的 UI 主題樣式，全部集中由 [js/config.js](file:///d:/03.Project/Other/GitHub/ExamTraining/js/config.js) 統一管理：

```javascript
var examSettings = {
    // 目標下拉選單 Selector
    selector: "#qaYP",

    // 預設載入的考卷 ID (網址未帶參數時使用)
    defaultExamId: "113-1",

    // 考卷清單
    exams: [
        {
            id: "113-1",                        // 下拉選單 value 與網址參數識別碼
            name: "113 年【金融市場常識】",       // 下拉選單顯示文字
            file: "data/Exam-113-1.js"          // 對應之題庫檔案路徑
        },
        {
            id: "113-2",
            name: "113 年【職業道德】",
            file: "data/Exam-113-2.js"
        }
    ],

    // 模擬試題測驗預設參數設定
    mockExam: {
        totalQuestions: 50, // 每次測驗預設總出題數
        // 題庫來源與各題庫抽取題數 (支援多題庫配置)
        banks: [
            {
                examId: "113-1", // 對應上方 exams 的 id
                count: 25        // 該題庫抽取題數
            },
            {
                examId: "113-2",
                count: 25
            }
        ]
    },

    // UI 介面多樣式預設設定 (主題風格與字體大小)
    uiTheme: {
        defaultTheme: "blue",       // "blue" (科技藍) | "dark" (暗黑護眼) | "green" (清新薄荷) | "sepia" (暖陽米紙) | "purple" (雅緻紫羅)
        defaultFontSize: "normal"   // "normal" (標準 100%) | "medium" (舒適 112%) | "large" (大字 125%)
    }
};

// 相容以 examConfig 直接存取考卷陣列
var examConfig = examSettings.exams;
// 模擬試題預設設定
var mockExamSettings = examSettings.mockExam;
// UI 主題樣式預設設定
var uiThemeSettings = examSettings.uiTheme;
```

---

## 🎨 UI 介面多樣式選擇 (Themes & Styles)

點擊頂部導航列的「**🎨 樣式**」按鈕，可即時展開浮動樣式面板自由切換：

### 1. 五款精選主題色彩
- 🔵 **科技湛藍 (Tech Blue)**：經典現代商務藍調，清晰專注（預設）。
- 🌙 **深色暗黑 (Dark Night)**：夜間低光源護眼模式，低炫光高舒適度。
- 🍃 **清新薄荷 (Mint Green)**：柔和綠意基調，有效舒緩長時間盯螢幕的視覺疲勞。
- 📜 **暖陽米紙 (Warm Sepia)**：仿實體書本與護眼電子紙溫潤質感，柔和親切。
- 🟣 **雅緻紫羅 (Elegant Violet)**：現代沉靜典雅紫韻，營造專注沉著的測驗氛圍。

### 2. 三段字體排版縮放
- **標準 (100%)**：適中比例，標準排版。
- **舒適 (112%)**：字體稍大、行距加大，適合多數考生長時間作答閱讀。
- **放大 (125%)**：大字體閱覽，大螢幕或需要清晰大字的考生首選。

### 3. 自動偏好記憶
- 任何主題與字體切換皆會自動儲存至瀏覽器 `localStorage`，重新整理或下次開啟頁面時自動維持個人偏好。

---

## 測驗模式說明

### 1. 📘 循序練習模式 (Practice Mode)
- **逐題練習**：可自由選擇考卷，按題號依序練習或隨選題號跳轉。
- **即時詳解**：作答後點擊「看答案 (Enter)」即時查看對錯高亮與官方詳解。
- **鍵盤快速鍵**：
  - `←`（向左方向鍵）：切換至上一題
  - `→`（向右方向鍵）：切換至下一題
  - `Enter`：查看答案與詳解說明
  - `↑` / `↓`（向上/向下方向鍵）：移動選取焦點
  - `Space` / `Ctrl` / `Alt`：勾選/切換當前選取的選項

### 2. 🎯 模擬試題測驗模式 (Mock Exam Mode)
- **彈性配題設定**：支援自訂每次測驗總出題數，自由勾選多個題庫來源並設定各題庫抽題題數（支援即時連動加總與一鍵恢復預設值）。
- **隨機抽取引擎**：採用 Fisher-Yates 洗牌演算法無重複隨機抽題，並混合打散題目順序。
- **作答暫存與計時**：具備獨立考試計時器、切換題目自動保留作答狀態、快速跳題選單標記已作答項。
- **成績結算與深度解析**：交卷後換算 100 分制成績、標記及格狀態（70 分合格線）、統計各題庫得分率，並提供「全部試題」、「僅看錯題」與「僅看答對」篩選回顧。

---

## 🌐 線上展示 (Online Demo)

🔗 **GitHub Pages 線上體驗**：[https://cubshuang.github.io/ExamTraining/](https://cubshuang.github.io/ExamTraining/)
