/** Validate every domain before installing any of them, in dependency order. */
export async function installProfileDomains(domains: readonly { validate(): void; install(): void | Promise<void> }[]) {
  domains.forEach(domain => domain.validate());
  for (const domain of domains) await domain.install();
}
