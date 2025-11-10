import { defineConfig, devices } from '@playwright/test';

/**
 * 从文件中读取环境变量
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * 详细配置请参考：https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  /* 在文件中并行运行测试 */
  fullyParallel: true,
  /* 如果在 CI 中意外留下 test.only，则使构建失败 */
  forbidOnly: !!process.env.CI,
  /* 仅在 CI 中重试失败的测试 */
  retries: process.env.CI ? 2 : 0,
  /* 在 CI 中选择退出并行测试 */
  workers: process.env.CI ? 1 : undefined,
  /* 使用的报告器。详见：https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* 以下所有项目的共享设置。详见：https://playwright.dev/docs/api/class-testoptions */
  use: {
    /* 在操作中使用的基础 URL，例如 `await page.goto('/')` */
    // baseURL: 'http://localhost:3000',

    /* 显示浏览器界面（调试时启用，正式测试时可注释掉） */
    headless: false,
    
    /* 减慢操作速度，方便观察（单位：毫秒） */
    // slowMo: 500,

    /* 在重试失败的测试时收集追踪信息。详见：https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* 为主流浏览器配置测试项目 */
  projects: [
    {
      name: 'chromium',
      use: { 
        // 不使用 devices 预设，因为它包含的 deviceScaleFactor 与 viewport: null 冲突
        // 设置为 null 让浏览器使用窗口的实际大小，而不是固定视口
        viewport: null,
        // 启动浏览器时的参数设置
        launchOptions: {
          args: [
            '--start-maximized', // 窗口最大化启动
            // '--start-fullscreen', // 如果需要真正的全屏模式（F11效果），使用这个
          ],
        },
        // 自动授予剪贴板权限，避免每次手动点击
        permissions: ['clipboard-read', 'clipboard-write'],
      },
    },

    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },

    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },

    /* 针对移动端视口的测试 */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* 针对品牌浏览器的测试（使用系统安装的真实浏览器） */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* 在开始测试前运行本地开发服务器 */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});
