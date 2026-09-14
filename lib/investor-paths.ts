export type InvestorPath = {
  id: string
  title: string
  stage: string
  summary: string
  academyHref: string
  workspaceHref: string
  tier: 'Free' | 'Pro'
}

export const INVESTOR_PATHS: InvestorPath[] = [
  { id: 'foreclosure', title: 'Foreclosure bidder', stage: 'Acquire', summary: 'Find a judicial sale, verify the file, set a ceiling, and prepare for the clerk auction.', academyHref: '/academy/foreclosures-101', workspaceHref: '/radar?type=foreclosure', tier: 'Free' },
  { id: 'tax-deed', title: 'Tax-deed buyer', stage: 'Acquire', summary: 'Screen tax-deed inventory for access, occupancy, liens, and a defensible all-in basis.', academyHref: '/academy/tax-deeds-101', workspaceHref: '/radar?type=tax_deed', tier: 'Free' },
  { id: 'certificate', title: 'Certificate investor', stage: 'Acquire', summary: 'Understand certificate yield, redemption, and the point where a certificate can become a deed application.', academyHref: '/academy/tax-deeds-101', workspaceHref: '/academy/investor-paths#certificate', tier: 'Free' },
  { id: 'rehab-rent', title: 'Rehab to rent', stage: 'Operate', summary: 'Turn a won property into a scoped rehab and a rent-based acquisition ceiling.', academyHref: '/academy/investor-paths#rehab-rent', workspaceHref: '/academy/workbooks#rehab-rent', tier: 'Pro' },
  { id: 'rehab-flip', title: 'Rehab to flip', stage: 'Operate', summary: 'Set a flip ceiling from resale value, rehab, carry, selling costs, and required profit.', academyHref: '/academy/investor-paths#rehab-flip', workspaceHref: '/academy/workbooks#rehab-flip', tier: 'Pro' },
  { id: 'long-term-rental', title: 'Long-term rental', stage: 'Operate', summary: 'Compare stabilized rent, operating costs, cap rate, and light rehab without inventing a valuation.', academyHref: '/academy/investor-paths#long-term-rental', workspaceHref: '/academy/workbooks#long-term-rental', tier: 'Pro' },
  { id: 'wholesale', title: 'Wholesaler', stage: 'Exit', summary: 'Check whether the buyer spread covers basis, costs, and a real minimum fee.', academyHref: '/academy/investor-paths#wholesale', workspaceHref: '/academy/workbooks#wholesale', tier: 'Pro' },
  { id: 'land', title: 'Land buyer', stage: 'Acquire / Exit', summary: 'Price vacant land from access, resale, carrying time, closing costs, survey, and profit.', academyHref: '/academy/investor-paths#land', workspaceHref: '/academy/workbooks#land', tier: 'Pro' },
  { id: 'multifamily', title: 'Small multifamily operator', stage: 'Operate', summary: 'Use the existing project budget and scopes workspace for two-to-four-unit execution.', academyHref: '/academy/investor-paths#multifamily', workspaceHref: '/projects', tier: 'Pro' },
]
