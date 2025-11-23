---
"@huaguang/block-crawler": patch
---

修复测试模式下的信号处理

- 测试模式现在可以正确处理 Ctrl+C (SIGINT) 和 SIGTERM 信号
- 按下 Ctrl+C 时会显示 "📡 收到信号 SIGINT，正在保存状态..." 日志
- 会同步保存 filename mapping，确保数据不丢失
- 不再输出多余的错误日志，行为与其他模式保持一致

