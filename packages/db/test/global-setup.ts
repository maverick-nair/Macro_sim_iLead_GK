import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/** Applies migrations to the test database before the integration tests run. */
export default function setup(): void {
  if (process.env.GK_SKIP_DB_TESTS === "1") return;
  const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url)
    throw new Error(
      "Set TEST_DATABASE_URL or DATABASE_URL for @gk/db integration tests (or GK_SKIP_DB_TESTS=1)",
    );
  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });
}
