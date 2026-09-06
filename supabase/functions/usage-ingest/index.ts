import { createHandler } from "../usage-shared/handler.ts";
Deno.serve(createHandler("ingest", { env: name => Deno.env.get(name), fetch }));
