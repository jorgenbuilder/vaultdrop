interface Props {
  onSignIn: () => void;
}

const FAQ = [
  {
    q: 'Why can\'t I just email documents to my clients?',
    a: 'Unencrypted email violates the FTC Safeguards Rule (revised June 2023), which classifies all tax preparers as "financial institutions" required to encrypt client data in transit. A breach affecting 300 clients can cost $50,000+ in notification costs alone — before legal fees or lost clients.',
  },
  {
    q: 'How is this different from SmartVault or ShareFile?',
    a: 'Those portals require your client to create an account, remember a password, and navigate a dashboard — for something they use once a year. VaultDrop sends a single magic link. No signup, no password, no app to install. Your client clicks the link and sees the document.',
  },
  {
    q: 'What if someone intercepts the magic link?',
    a: 'Each drop is encrypted with a key derived from the link itself. Without the exact link, the data is indecipherable — even to us, even to the servers hosting it. You can also set drops to expire after a single use ("burn after reading") so a forwarded link is worthless.',
  },
  {
    q: 'Where is the data stored?',
    a: 'On the Internet Computer — a decentralized network of independently operated nodes. No single company, including us, can access your encrypted data. The encryption keys are split across multiple nodes using threshold cryptography. A supermajority would have to collude to derive a key.',
  },
  {
    q: 'Does this meet IRS Publication 4557 requirements?',
    a: 'VaultDrop encrypts data in transit and at rest using threshold-derived keys, satisfying the encryption requirements of Pub 4557 and the FTC Safeguards Rule. Every access is logged with a timestamp and cryptographic identity, giving you an audit trail for your Written Information Security Plan (WISP).',
  },
  {
    q: 'What happens if my client forgets to open the link?',
    a: 'Nothing — the encrypted drop stays available until it expires or reaches its claim limit. You can check who has and hasn\'t opened it from your dashboard and resend the link if needed.',
  },
  {
    q: 'Can I see who opened my drop?',
    a: 'Yes. Your dashboard shows every claim with a timestamp. You always know exactly who accessed what and when — useful for compliance documentation and client follow-up.',
  },
  {
    q: 'How much does it cost?',
    a: 'VaultDrop is free during the beta period. Compare that to $500–$900/year for a client portal your clients complain about using.',
  },
];

export function Landing({ onSignIn }: Props) {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="max-w-2xl mx-auto px-4 pt-16 pb-12 text-center">
        <h1 className="text-4xl font-bold tracking-tight mb-4">
          Share secrets with clients in 60 seconds.
          <br />
          <span className="text-muted-foreground">Perfect privacy.</span>
        </h1>
        <p className="text-lg text-muted-foreground mb-8 max-w-lg mx-auto">
          Stop emailing SSNs and tax documents. Send an encrypted magic link
          instead. No client signup. No passwords to forget. No portal to
          manage.
        </p>
        <button
          onClick={onSignIn}
          className="rounded-md bg-primary px-8 py-3 text-base text-primary-foreground hover:opacity-90"
        >
          Start sharing securely
        </button>
        <p className="text-xs text-muted-foreground mt-3">
          Free during beta. No credit card required.
        </p>
      </div>

      {/* How it works */}
      <div className="max-w-2xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-semibold text-center mb-8">
          Three steps. Sixty seconds.
        </h2>
        <div className="grid gap-6">
          {[
            {
              step: '1',
              title: 'Paste your content',
              desc: 'Tax return, API key, bank details — any text you need to share securely.',
            },
            {
              step: '2',
              title: 'Get a magic link',
              desc: 'Your content is encrypted in your browser before it ever leaves your device. The link is the only key.',
            },
            {
              step: '3',
              title: 'Send it to your client',
              desc: 'They click the link. They see the content. No signup, no password, no app. You see when they opened it.',
            },
          ].map((item) => (
            <div
              key={item.step}
              className="flex gap-4 rounded-lg border border-border bg-card p-5"
            >
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                {item.step}
              </div>
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pain points */}
      <div className="max-w-2xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-semibold text-center mb-2">
          Built for tax professionals
        </h2>
        <p className="text-center text-muted-foreground mb-8">
          Because your clients won't use a portal they log into once a year.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            {
              title: 'FTC compliant',
              desc: 'Encryption in transit and at rest. Satisfies the 2023 Safeguards Rule.',
            },
            {
              title: 'Audit trail',
              desc: 'Every access logged with timestamp and identity. Ready for your WISP.',
            },
            {
              title: 'No client friction',
              desc: 'A magic link. That\'s it. No signup, no password, no app download.',
            },
            {
              title: 'Burn after reading',
              desc: 'Set drops to self-destruct after one claim. A forwarded link is worthless.',
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-lg border border-border bg-card p-4"
            >
              <p className="font-medium mb-1">{item.title}</p>
              <p className="text-sm text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="max-w-2xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-semibold text-center mb-8">
          Frequently asked questions
        </h2>
        <div className="space-y-4">
          {FAQ.map((item, i) => (
            <details
              key={i}
              className="rounded-lg border border-border bg-card group"
            >
              <summary className="cursor-pointer px-5 py-4 font-medium text-sm list-none flex items-center justify-between">
                {item.q}
                <span className="text-muted-foreground group-open:rotate-45 transition-transform text-lg">
                  +
                </span>
              </summary>
              <div className="px-5 pb-4 text-sm text-muted-foreground">
                {item.a}
              </div>
            </details>
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-semibold mb-4">
          Stop risking client data over email.
        </h2>
        <button
          onClick={onSignIn}
          className="rounded-md bg-primary px-8 py-3 text-base text-primary-foreground hover:opacity-90"
        >
          Start sharing securely
        </button>
      </div>

      {/* Footer */}
      <div className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        VaultDrop — encrypted document sharing powered by the Internet Computer
      </div>
    </div>
  );
}
