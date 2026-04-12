import { Link } from 'react-router-dom';
import { KabboLogo } from '@/components/KabboLogo';
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
            Back to Kabbo
          </Button>
        </Link>

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <KabboLogo size={56} />
          <div>
            <h1 className="font-display text-4xl font-bold tracking-tight text-foreground">
              Kabbo
            </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Your publication pipeline, simplified.
          </p>
          </div>
        </div>

        {/* Definition */}
        <section className="mb-10">
          <h2 className="font-display text-xl font-semibold mb-3 text-foreground">
            What is Kabbo?
          </h2>
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-lg leading-relaxed text-foreground/90 italic">
              <strong className="text-accent not-italic">kabbo</strong> <span className="text-muted-foreground">/ˈkabːo/</span> – a dream, a story yet to be told.
            </p>
            <p className="text-sm text-muted-foreground mt-4">
              In academia, the journey from a nascent idea to a published work is rarely linear.
              It requires focus, iteration, and the courage to refine broad concepts into concrete contributions.
              Kabbo is designed to help researchers and research teams navigate this journey with clarity and intention.
            </p>
          </div>
        </section>

        {/* Who was ||kabbo? */}
        <section className="mb-10">
          <h2 className="font-display text-xl font-semibold mb-3 text-foreground">
            Who was ||kabbo?
          </h2>
          <div className="text-sm text-muted-foreground leading-relaxed space-y-3">
            <p>
              ||Kabbo (c. 1820s–1876) was a |Xam storyteller from the Karoo in what is
              now South Africa's Northern Cape. The |Xam were the southern San people of
              the interior; their language is today extinct. In |Xam, his name
              ||kabbo means "dream."
            </p>
            <p>
              In 1869 he was imprisoned at the Cape for stock theft, a consequence of
              the collapse of |Xam life under colonial pressure. From 1871 to 1873 he
              lived at the Mowbray home of the philologist Wilhelm Bleek and his
              sister-in-law Lucy Lloyd, where the three of them recorded hundreds of
              pages of |Xam stories, customs, cosmology, songs and hunting knowledge.
              That archive – published as{' '}
              <em>Specimens of Bushman Folklore</em> (Bleek &amp; Lloyd, 1911) – is one
              of the primary sources we still have for |Xam thought.
            </p>
            <p>
              His most celebrated narration,{' '}
              <em>||kabbo's Intended Return Home</em>, is a long and patient account of
              his imagined journey back to his people at the Bitterpits. He measures it
              against seasons (from the tip of the ||kwanna to its root), paths, moons,
              and the waiting that goes with each. That staged, seasonal journey reads
              like a near-perfect metaphor for the life of an academic paper, which
              rarely moves in a straight line and always involves waiting for the right
              moment. Naming this app after him is a small gesture of respect to a
              voice that had already told us, more eloquently than we could, what it is
              to carry something through many stages toward a destination.
            </p>
            <p className="text-xs">
              The ||kabbo quotes that appear in the app when you move a card
              forward are drawn from his own 1871–1873 narrations as recorded
              by Lucy Lloyd and Wilhelm Bleek. See <strong>Sources</strong>{' '}
              below for the papers by Neil Rusch that guide this material.
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
            Kabbo visualises this pipeline, helping you track progress, collaborate with co-authors, 
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
              <strong>Kabbo</strong> was created by economic historian <strong>Johan Fourie</strong> in January 2026.
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

        {/* Sources */}
        <section className="mb-10">
          <h2 className="font-display text-xl font-semibold mb-3 text-foreground">
            Sources
          </h2>
          <div className="text-xs text-muted-foreground leading-relaxed space-y-3">
            <p>
              ||kabbo's own words used in the app come from his 1871–1873
              narrations to Lucy Lloyd and Wilhelm Bleek, first published in{' '}
              <em>Specimens of Bushman Folklore</em> (Bleek &amp; Lloyd, 1911)
              – and are therefore in the public domain.
            </p>
            <p>
              The biographical sketch and the framing of ||kabbo's "Intended
              Return Home" as a staged journey draw on three papers by{' '}
              <strong>Neil Rusch</strong>, to whom we are grateful:
            </p>
            <ol className="list-decimal list-outside ml-5 space-y-2">
              <li>
                Rusch, N. 2016. The root and tip of the ||kwanna: introducing
                chiasmus in |xam narratives.{' '}
                <em>Critical Arts</em> 30(6): 877–897.{' '}
                <a
                  href="https://doi.org/10.1080/02560046.2016.1263219"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline inline-flex items-center gap-1"
                >
                  DOI
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                Rusch, N. 2016. Sounds and sound thinking in |xam-ka !au:
                "These are those to which I am listening with all my ears".{' '}
                <em>Cogent Arts &amp; Humanities</em> 3(1): 1233615 (open
                access, CC-BY 4.0).{' '}
                <a
                  href="https://doi.org/10.1080/23311983.2016.1233615"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline inline-flex items-center gap-1"
                >
                  DOI
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                Rusch, N. 2016. <em>Root and Tip of the ||Kwanna: Chiasmus in
                |Xam Narratives</em> (author manuscript / longer version of
                the Critical Arts paper).
              </li>
            </ol>
            <p>
              Primary archival source: Bleek, W.H.I. &amp; Lloyd, L.C. 1911.{' '}
              <em>Specimens of Bushman Folklore</em>. London: George Allen &amp; Co.
              The original manuscripts are held at UCT Libraries, Special
              Collections and Archives, and are accessible via{' '}
              <a
                href="http://lloydbleekcollection.cs.uct.ac.za/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline inline-flex items-center gap-1"
              >
                The Digital Bleek and Lloyd
                <ExternalLink className="w-3 h-3" />
              </a>
              .
            </p>
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
