import { createHandler } from "../usage-shared/handler.ts";
Deno.serve(createHandler("owner", { env: name => Deno.env.get(name), fetch }));

