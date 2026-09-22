# ExamTraining 自我測驗系統

ExamTraining 是一個使用 HTML + JavaScript + CSS 所建構的純靜態自我測驗網頁工具，無需後端伺服器與資料庫，直接以瀏覽器開啟 `index.html` 即可使用。

---

## 專案目錄結構

```text
ExamTraining/
├── index.html               # 測驗主畫面（入口網頁）
├── README.md                # 專案說明與操作指南
├── css/
│   └── QA.css               # 現代化響應式 UI 樣式表
├── js/
│   ├── config.js            # 考卷參數設定檔（設定選單名稱、ID 及題庫檔名）
│   ├── Tool.js              # 工具函式與動態題庫載入器
│   └── QA.js                # 測驗核心互動邏輯與鍵盤事件
└── data/
    ├── Exam-113-1.js        # 113 年金融市場常識題庫 (616 題)
    └── Exam-113-2.js        # 113 年職業道德題庫 (504 題)
```

---

## 考卷參數設定 (`js/config.js`)

考卷選單（`#qaYP`）的 **選項名稱**、**選項 ID** 以及 **對應之題庫檔名**，全部集中由 [js/config.js](file:///d:/03.Project/Other/GitHub/ExamTraining/js/config.js) 統一管理：

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
    ]
};

// 相容以 examConfig 直接存取考卷陣列
var examConfig = examSettings.exams;
```

### 如何新增考卷？
1. 將題庫檔案（例如 `Exam-114-1.js`）放置於 `data/` 目錄下。
2. 開啟 `js/config.js`，在 `exams` 陣列中新增一筆設定：
   ```javascript
   {
       id: "114-1",
       name: "114 年【金融市場常識】",
       file: "data/Exam-114-1.js"
   }
   ```
3. 存檔後重新整理瀏覽器即可在右上角選單看到新考卷，**完全不需要修改任何主程式碼**！

---
## 🌐 線上展示 (Online Demo)

🔗 **GitHub Pages 線上體驗**：[https://cubshuang.github.io/ExamTraining/](https://cubshuang.github.io/ExamTraining/)

## 操作說明與快速鍵

### 滑鼠操作
- **選取試卷**：右上角「試卷」下拉選單切換（亦支援網址帶參數，如 `?exam=113-1` 或 `?exam=113-2`）。
- **跳轉題目**：右上角「題號」下拉選單直接切換目標題目。
- **作答選取**：點擊選項卡片任一處（文字、徽章或圓圈/方塊）皆可快速勾選。
- **查看答案**：點擊「看答案」按鈕。
- **切換題目**：點擊「上一題」或「下一題」按鈕。

### 鍵盤快速鍵
- `←`（向左方向鍵）：切換至上一題
- `→`（向右方向鍵）：切換至下一題
- `Enter`：查看答案與詳解說明
- `↑` / `↓`（向上/向下方向鍵）：移動選取焦點
- `Space`（空白鍵）/ `Ctrl` / `Alt`：勾選/切換當前選取的選項
