// JSON export/import for sharing plans — matches v1's file format exactly
// (reference-v1-app.html:1777-1786, 1961-1971) so exported v1 plan files
// import cleanly here, and vice versa.
import type { Plan } from "@/lib/store/plan";

export function downloadPlanJson(plan: Plan) {
  const text = JSON.stringify({ kind: "study-abroad-plan", version: 2, plan }, null, 2);
  const blob = new Blob([text], { type: "application/json" });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = `${(plan.name || "plan").replace(/[^\w-]+/g, "_")}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

export function parsePlanFile(text: string): Partial<Plan>[] {
  const data = JSON.parse(text);
  if (data?.plan) return [data.plan];
  if (Array.isArray(data?.plans)) return data.plans;
  throw new Error("not a plan file");
}
