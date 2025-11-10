import cliProgress from "cli-progress";

const progressBar = new cliProgress.SingleBar({
  format: '📊 进度 |{bar}| {percentage}% | {value}/{total} 个链接 | 耗时: {duration_formatted} | ETA: {eta_formatted}',
  barCompleteChar: '\u2588',
  barIncompleteChar: '\u2591',
  hideCursor: true,
  barsize: 40,
});

progressBar.start(100, 0);
progressBar.update(50);
progressBar.stop();