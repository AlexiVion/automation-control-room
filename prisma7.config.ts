import { defineConfig } from "prisma/config";
export default defineConfig({
  schema: "spikes/gate4d/prisma/schema.prisma",
  datasource: { url: process.env.DATABASE_URL ?? "" }
});
