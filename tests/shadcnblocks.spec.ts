import { test } from "@playwright/test";
import { BlockCrawler } from "@huaguang/block-crawler";

test("shadcnblocks", async ({ page }) => {
    test.setTimeout(1 * 60 * 1000); // 1 分钟

    const crawler = new BlockCrawler(page, {
        startUrl: "https://www.shadcnblocks.com/blocks",
        // progress: {
        //     enable: true, 
        //     rebuild: {
        //         saveToProgress: true,
        //     }
        // }
    });

    await crawler
        .auth()
        .open("https://www.shadcnblocks.com/blocks", "networkidle")
        .page(async ({ currentPage }) => {
            await currentPage.getByRole('radio', { name: 'List view' }).click();
        })
        .block('//div[@id="block-list"]/div/div', true)
        .skipFree("Free")
        .run();
});