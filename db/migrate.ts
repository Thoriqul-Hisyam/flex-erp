import { db } from "./index";
import { migrate } from "drizzle-orm/node-postgres/migrator";

async function main() {
  console.log("🚀 Executing Drizzle ORM Migrations...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("🎉 SUCCESS: Drizzle ORM Migrations applied to PostgreSQL database!");
}

main()
  .catch((err) => {
    console.error("❌ Migration error:", err);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
