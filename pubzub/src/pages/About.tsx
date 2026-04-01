import { Link } from 'react-router-dom';
import { PubZubLogo } from '@/components/PubZubLogo';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ExternalLink } from 'lucide-react';

export default function About() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Back link */}
        <Link to="/">
          <Button variant="ghost" size="sm" className="mb-8 -ml-2 gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to PubZub
          </Button>
        </Link>

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <PubZubLogo size={56} />
          <div>
            <h1 className="font-display text-4xl font-bold tracking-tight text-foreground">
              PubZub
            </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Your publication pipeline, simplified.
          </p>
          </div>
        </div>

        {/* Definition */}
        <section className="mb-10">
          <h2 className="font-display text-xl font-semibold mb-3 text-foreground">
            What is a zub?
          </h2>
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-lg leading-relaxed text-foreground/90 italic">
              <strong className="text-accent not-italic">zub</strong> <span className="text-muted-foreground">/zəb/</span> — a zippy funnel-path.
            </p>
            <p className="text-sm text-muted-foreground mt-4">
              In academia, the journey from a nascent idea to a published work is rarely linear. 
              It requires focus, iteration, and the courage to refine broad concepts into concrete contributions. 
              PubZub is designed to help researchers navigate this journey with clarity and intention.
            </p>
          </div>
        </section>

        {/* The Pipeline */}
        <section className="mb-10">
          <h2 className="font-display text-xl font-semibold mb-3 text-foreground">
            The Pipeline
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Every research project moves through stages: from initial <strong>Idea</strong> to working <strong>Draft</strong>, 
            through <strong>Submission</strong> and the often lengthy <strong>Revise & Resubmit</strong> process, 
            until it's finally <strong>Accepted</strong> and <strong>Published</strong>. 
            PubZub visualises this pipeline, helping you track progress, collaborate with co-authors, 
            and maintain momentum across your research portfolio.
          </p>
        </section>

        {/* Creator Info */}
        <section className="mb-10">
          <h2 className="font-display text-xl font-semibold mb-3 text-foreground">
            About
          </h2>
          <div className="bg-secondary/30 rounded-lg p-5 space-y-3">
            <p className="text-sm text-foreground">
              <strong>PubZub</strong> was created by economic historian <strong>Johan Fourie</strong> in January 2026.
            </p>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Stellenbosch, South Africa</p>
              <a 
                href="https://johanfourie.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-accent hover:underline"
              >
                johanfourie.com
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="pt-6 border-t border-border text-center">
          <p className="text-xs text-muted-foreground">
            Built with care for researchers everywhere.
          </p>
        </footer>
      </div>
    </div>
  );
}
