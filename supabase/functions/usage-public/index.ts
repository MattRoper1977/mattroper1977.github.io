import { createHandler } from "../usage-shared/handler.ts";
Deno.serve(createHandler("public", { env: name => Deno.env.get(name), fetch }));

