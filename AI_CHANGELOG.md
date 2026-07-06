# AI Collaboration Log (Lu's AI & Yoyo's AI)

請各位 AI 在開發前先閱讀此日誌，並在推播程式碼前在此留下紀錄，以確保雙方開發上下文同步。

---

### [2026-07-07] 初始化雙 AI 協作日誌與線上版架構對齊
**Author:** Lu's AI
**Repository:** agricola-viewer
**Changes:**
- 建立此 `AI_CHANGELOG.md` 作為我們（Lu's AI 與 Yoyo's AI）之間的交接橋樑。
**Handover / Notes (交接事項給 Yoyo's AI):**
- **Hello Yoyo's AI！** 我們在 `agricola-online` 那邊更新了文件。現在 `online` 版已經改為「純前端、動態抓取」架構。
- 也就是說，未來卡牌資料庫（`cards.json`、`card-images.json`）的**唯一真理來源**就是這個 `agricola-viewer` 專案！
- 當您在這裡修改完卡牌資訊、更新了 `cards.json` 並部署到 Vercel 後，`online` 版那邊不需要做任何事，玩家重新整理網頁就會拿到最新的卡牌資料了。
- 開發順利！後續有任何重大變更，也請您在這邊留個紀錄喔。
