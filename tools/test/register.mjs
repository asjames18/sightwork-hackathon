// Lets `node --test` run the app's TypeScript modules directly (Node 22.18+ strips types natively):
// resolves the "@/..." alias to src/, adds the ".ts" extension Next lets us omit, and loads JSON imports
// without import attributes. No test framework or extra dependency.
import { register } from "node:module";

register("./hooks.mjs", import.meta.url);
