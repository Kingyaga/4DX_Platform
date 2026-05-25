require("dotenv/config");

const { Client } = require("pg");

async function main() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DIRECT_URL or DATABASE_URL is required.");
  }

  const url = new URL(connectionString);
  url.searchParams.set("uselibpqcompat", "true");

  const client = new Client({ connectionString: url.toString() });
  await client.connect();

  const tables = await client.query(
    "select table_name from information_schema.tables where table_schema = $1 and table_type = $2 order by table_name",
    ["public", "BASE TABLE"],
  );

  console.log("Tables:");
  console.log(tables.rows.map((row) => `- ${row.table_name}`).join("\n"));

  if (tables.rows.some((row) => row.table_name === "_prisma_migrations")) {
    const migrations = await client.query(`
      select
        migration_name,
        finished_at is not null as finished,
        rolled_back_at is not null as rolled_back,
        logs is not null as has_logs
      from "_prisma_migrations"
      order by started_at
    `);

    console.log("\nMigrations:");
    console.table(migrations.rows);
  }

  await client.end();
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
