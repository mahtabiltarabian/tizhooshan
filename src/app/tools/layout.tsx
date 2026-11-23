import type { ReactNode } from "react";
import { RequireProfile } from "@/practice/RequireProfile";

// Every tool page asks for a registered child first (worksheets excepted).
export default function ToolsLayout({ children }: { children: ReactNode }) {
  return <RequireProfile>{children}</RequireProfile>;
}
