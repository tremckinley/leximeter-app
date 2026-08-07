/**
 * Static sidebar with About, Instructions, and Methodology content.
 */
import logo from '../assets/logo.svg';
import logo2 from '../assets/logo.png';

export default function SidePanel() {
  return (
    <aside className="side-panel">
      <div className="center-logo">
        <img src={logo2} alt="Leximeter logo" className="heading-logo" />
        </div>
        <div className="heading-row">
          <h2>About</h2>
        
      </div>
      <div className="side-panel-content">
        <p>
          Leximeter is a web diagnostic tool designed to determine the languages present across a given domain for SEO and Web Accessibility purposes.
        </p>

        <h3>Instructions</h3>
        <ul>
          <li>Paste or type a list of root domains into the input field.</li>
          <li>
            Do not include URL paths{' '}
            <span className="emphasis">
              (e.g., use <code>water.org</code> instead of <code>water.org/es-us</code>)
            </span>
          </li>
          <li>Click <span className="emphasis">Start Analysis</span> to begin the diagnostic crawl.</li>
        </ul>

        <h3>Methodology</h3>
        <p>
          Leximeter performs a breadth-first search of up to five pages per domain, waiting for
          framework hydration only when a Single Page Application (SPA) is detected. It identifies
          languages by extracting <code>html lang</code> attributes, <code>hreflang</code>{' '}
          declarations, and analyzing URL paths.
          <br /><br />
          <span className="emphasis">Note:</span> If a single-page application or site that has content that can't be crawled is detected, they are flagged for manual review. Leximeter does not have the capacity to interact with the browser at this stage.
        </p>

        <div className="copyright">
          Built and maintained by{' '}
          <a href="https://github.com/tremckinley" target="_blank" rel="noopener noreferrer">
            Tremaine McKinley
          </a>
        </div>
      </div>
    </aside>
  );
}
