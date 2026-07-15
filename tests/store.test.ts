import { test, expect } from "bun:test";
import { SecretStore } from "../src/store";

test("burns after configured views", async () => {
  const s = new SecretStore(false);
  const id = await s.create("blob", 60, 2);
  expect(await s.consume(id)).toBe("blob");
  expect(await s.consume(id)).toBe("blob");
  expect(await s.consume(id)).toBeNull(); // burned
});

test("expired secret returns null", async () => {
  const s = new SecretStore(false);
  const id = await s.create("x", -1, 5); // already expired
  expect(await s.consume(id)).toBeNull();
});

test("unknown id returns null", async () => {
  const s = new SecretStore(false);
  expect(await s.consume("nope")).toBeNull();
});

test("sweep drops expired entries", async () => {
  const s = new SecretStore(false);
  await s.create("a", -1, 1);
  await s.create("b", 60, 1);
  expect(s.sweep()).toBe(1);
  expect(s.size()).toBe(1);
});
