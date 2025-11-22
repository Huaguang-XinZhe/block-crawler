---
"@huaguang/block-crawler": patch
---

fix: 删除 Free Block 跳过统计日志，并在停止时保存 free.json

- 删除"已跳过 X 个 Free Block"的总结性日志，减少冗余输出
- 在 Ctrl+C 终止时调用 cleanup() 保存 free.json，确保 Free Block 记录不丢失

