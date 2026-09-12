/**
 * Fixed key -> prompt map for the ?deed= deep link.
 *
 * Inbound links (e.g. the sample report's hidden max-bid cell) carry a key,
 * never raw prompt text: links stay clean and nobody can prefill the
 * composer with arbitrary text from a URL. Unknown keys are ignored.
 */
export const DEED_SEEDS: Record<string, string> = {
  'sample-maxbid':
    "On the sample report the SIGNAL$ Max Bid shows as Hidden - what does that mean, and what would the $25 report give me on a property I'm watching?",
}
