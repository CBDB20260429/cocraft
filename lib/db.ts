import neo4j, { type Driver } from "neo4j-driver";

let driver: Driver | undefined;

export function getDriver() {
  const uri = process.env.NEO4J_URI;
  const username = process.env.NEO4J_USERNAME;
  const password = process.env.NEO4J_PASSWORD;

  if (
    !uri ||
    !username ||
    !password ||
    uri.includes("HOST.") ||
    password === "..."
  ) {
    return null;
  }

  driver ??= neo4j.driver(uri, neo4j.auth.basic(username, password));

  return driver;
}

export function getDatabaseName() {
  return process.env.NEO4J_DATABASE ?? "neo4j";
}
