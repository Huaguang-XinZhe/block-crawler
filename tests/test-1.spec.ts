import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  // Recording...
  await page.goto('https://pro.mufengapp.cn/components');
  // 获取所有 tab 的名称
  await page.getByRole('tablist', { name: 'Categories' }).click();
  // 点击某一个 tab
  await page.getByRole('tab', { name: 'Charts' }).click();


  
  await page.getByRole('link', { name: 'Bars And Circles image Bars' }).click();
  await page.getByRole('link', { name: 'Circles 3' }).click();
  await page.locator('[id="react-aria6795193497-:r6:-tab-code"]').click();
  await page.getByRole('button', { name: 'Copy Code' }).nth(1).click();
  await page.getByRole('button', { name: 'TypeScript Change theme' }).click();
  await page.getByRole('option', { name: 'JavaScript' }).click();

  await page.getByRole('tab', { name: 'multistep-sidebar.tsx' }).click();
  await page.getByRole('tablist', { name: 'Select active file' }).hover();
  const download1Promise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Copy Code' }).first().click();
  const download1 = await download1Promise;
});