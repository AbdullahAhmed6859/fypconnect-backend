import { prisma } from "../config/prisma.js";

async function main() {
  const result = await prisma.$queryRaw`SELECT 1`;
  console.log("DB connected:", result);
}

main()
  .catch((err) => {
    console.error("Connection test failed:", err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });