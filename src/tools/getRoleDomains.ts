import { IndexBuilder } from "../utils/indexBuilder.js";

export function getRoleDomains(index: IndexBuilder): string[] {
  return index.getDomains();
}
