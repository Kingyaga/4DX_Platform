import { createPrismaClient } from "../src/server/prisma-client";

const db = createPrismaClient();

async function main() {
  const users = await db.user.findMany({
    select: { id: true, email: true, name: true },
  });
  console.log("Users found:", users.length);
  console.log(JSON.stringify(users, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
