// The default monthly cost limit in USD, `limits_cost_monthly`'s default in
// plugin.json, which `node scripts/check.ts` ties to it. A leaf module so that
// script can import it under Node with no build step.
export const MONTHLY_DEFAULT = 100
