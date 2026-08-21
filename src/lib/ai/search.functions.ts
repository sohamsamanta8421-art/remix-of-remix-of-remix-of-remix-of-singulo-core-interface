import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { runWebSearch } from "./search.server";

const schema = z.object({
  query: z.string().min(1).max(300),
  limit: z.number().int().min(1).max(8).optional(),
});

export const webSearch = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => runWebSearch(data.query, data.limit ?? 5));