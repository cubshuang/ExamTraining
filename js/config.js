/**
 * 測驗試卷參數設定檔 (Exam Configuration)
 * 
 * 設定說明：
 * - selector: 目標下拉選單之 CSS Selector (預設 "#qaYP")
 * - defaultExamId: 預設選取考卷 ID (網址未指定參數時使用)
 * - exams: 考卷清單陣列
 *     - id: 考卷代碼 / 識別碼 (例如: "113-1")，對應 select 的 value 與網址參數 (?exam=113-1)
 *     - name: 考卷顯示名稱 (例如: "113 年【金融市場常識】")，對應 select 顯示的文字
 *     - file: 對應的題庫資料檔案路徑 (例如: "data/Exam-113-1.js")
 */
var examSettings = {
    selector: "#qaYP",
    defaultExamId: "113-1",
    exams: [
        {
            id: "113-1",
            name: "113 年【金融市場常識】",
            file: "data/Exam-113-1.js"
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
    }
};

// 相容以 examConfig 直接存取考卷陣列
var examConfig = examSettings.exams;
// 模擬試題預設設定
var mockExamSettings = examSettings.mockExam;
