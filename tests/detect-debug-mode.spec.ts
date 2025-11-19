import { test } from "@playwright/test";

test("check mode", async (_, testInfo) => {
	console.log("is debug:", testInfo.config.workers === 1);
	console.log("debug:", isDebug);
});

export const isDebug = Boolean(
	process.env.PWDEBUG ||
		process.env.PW_TEST_DEBUG ||
		process.env.PLAYWRIGHT_INSPECTOR,
);
