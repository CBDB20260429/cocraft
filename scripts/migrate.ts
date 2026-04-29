import "dotenv/config";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import neo4j from "neo4j-driver";

async function main() {
  const uri = process.env.NEO4J_URI;
  const username = process.env.NEO4J_USERNAME;
  const password = process.env.NEO4J_PASSWORD;
  const database = process.env.NEO4J_DATABASE ?? "neo4j";

  if (
    !uri ||
    !username ||
    !password ||
    uri.includes("HOST.") ||
    password === "..."
  ) {
    throw new Error(
      "Real NEO4J_URI, NEO4J_USERNAME, and NEO4J_PASSWORD values are required."
    );
  }

  const cypher = await readFile(join(process.cwd(), "db", "schema.cypher"), "utf8");
  const statements = cypher
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
  const driver = neo4j.driver(uri, neo4j.auth.basic(username, password));
  const session = driver.session({ database });

  try {
    for (const statement of statements) {
      await session.run(statement);
    }
    console.log("Neo4j schema is up to date.");
  } finally {
    await session.close();
    await driver.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
