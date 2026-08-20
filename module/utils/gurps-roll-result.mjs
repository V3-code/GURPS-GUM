export function evaluateGurpsRollResult(total, effectiveLevel) {
  const rollTotal = Number(total);
  const target = Number(effectiveLevel);
  const isSuccess = rollTotal <= target;
  const margin = Math.abs(target - rollTotal);
  const isCriticalSuccess = rollTotal <= 4 || (rollTotal === 5 && target >= 15) || (rollTotal === 6 && target >= 16);
  const isCriticalFailure = rollTotal >= 18 || (rollTotal === 17 && target <= 15) || rollTotal - target >= 10;
  const rollOutcome = isSuccess ? "success" : "failure";
  if (isCriticalSuccess) return { isSuccess, margin, isCriticalSuccess, isCriticalFailure, rollOutcome, outcome: "critical-success", resultLabel: "Sucesso Crítico", statusClass: "crit-success" };
  if (isCriticalFailure) return { isSuccess, margin, isCriticalSuccess, isCriticalFailure, rollOutcome, outcome: "critical-failure", resultLabel: "Falha Crítica", statusClass: "crit-failure" };
  return { isSuccess, margin, isCriticalSuccess: false, isCriticalFailure: false, rollOutcome, outcome: rollOutcome, resultLabel: isSuccess ? "Sucesso" : "Falha", statusClass: isSuccess ? "success" : "failure" };
}