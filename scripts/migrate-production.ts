import { closeDbExec, withMigrationRuntime } from "@agent-native/core/db";
import { loadEnv } from "@agent-native/core/scripts";
import {
  runAppReleaseMigrations,
  runFrameworkReleaseMigrations,
} from "@agent-native/core/server";

loadEnv();

async function main(): Promise<void> {
  if (!/^postgres(?:ql)?:\/\//i.test(process.env.DATABASE_URL ?? "")) {
    throw new Error(
      "Production migrations require a PostgreSQL DATABASE_URL. Configure it for this deployment environment before rebuilding.",
    );
  }
  await withMigrationRuntime(async () => {
    await runFrameworkReleaseMigrations(null);
    await runAppReleaseMigrations();
  });
}

try {
  await main();
} finally {
  await closeDbExec();
}
